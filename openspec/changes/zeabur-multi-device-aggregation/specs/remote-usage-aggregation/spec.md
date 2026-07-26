## ADDED Requirements

### Requirement: Data source selection via DATA_SOURCE

The system SHALL select its usage data source based on the `DATA_SOURCE` environment variable. When `DATA_SOURCE` is `github`, the system SHALL fetch per-device usage snapshots from a GitHub private repository. When `DATA_SOURCE` is `local` or unset, the system SHALL preserve the existing local tokscale collection behavior unchanged.

#### Scenario: Local mode preserves existing behavior

- **WHEN** the server starts with `DATA_SOURCE` unset or set to `local`
- **THEN** the server SHALL collect usage via the local tokscale collector and MUST NOT fetch from GitHub

#### Scenario: GitHub mode fetches remote snapshots

- **WHEN** the server starts with `DATA_SOURCE` set to `github`
- **THEN** the server SHALL fetch `devices/*.json` from the configured private repository and MUST NOT spawn the tokscale CLI

### Requirement: Cross-device aggregation rules

The system SHALL aggregate per-device snapshots into a single normalized view. Cost values SHALL be summed across all devices whose provider entry has no error. Quota window values (usedPercent, remainingPercent, resetAt) SHALL be taken from the single device with the most recent `generatedAt` timestamp. The system MUST NOT sum quota percentages across devices.

#### Scenario: Cost is summed across devices

- **WHEN** two devices report today cost of 9 and 5 for the same provider with no error
- **THEN** the aggregated `cost.todayUSD` SHALL equal 14

##### Example: Two-device aggregation

| Device  | generatedAt          | claude.cost.todayUSD | claude.weekly usedPercent |
| ------- | -------------------- | -------------------- | ------------------------- |
| mac     | 2026-07-23T03:00:00Z | 9                    | 46                        |
| windows | 2026-07-23T02:00:00Z | 5                    | 40                        |
| result  | —                    | 14 (summed)          | 46 (from freshest: mac)   |

#### Scenario: Quota taken from freshest device

- **WHEN** multiple devices report differing quota percentages for a provider
- **THEN** the aggregated window values SHALL come from the device with the most recent `generatedAt`

#### Scenario: Errored device excluded from cost total

- **WHEN** a device's provider entry has a non-null error
- **THEN** that device's cost SHALL be excluded from the aggregated total

### Requirement: Activity source follows the selected data source

The activity state served by `/api/status` SHALL be derived from the active data source. In local mode the system SHALL continue to compute activity from local session-log file modification times. In GitHub mode the system MUST NOT read local session-log paths, and SHALL derive activity from the aggregated device snapshots, reporting `working` when any contributing device reports `working`.

#### Scenario: GitHub mode does not read local session logs

- **WHEN** the server serves `/api/status` in GitHub mode
- **THEN** it MUST NOT inspect local session-log paths and MUST NOT report `idle` merely because those paths are absent

#### Scenario: Any working device makes the aggregate working

- **WHEN** at least one contributing device reports activity `working` for a provider
- **THEN** the aggregated activity for that provider SHALL be `working`

### Requirement: Preserve the /api/status output contract

The aggregated output SHALL conform to the existing `/api/status` normalized schema so the frontend requires no changes. The system MAY include an additional per-device breakdown field that does not alter existing fields.

#### Scenario: Frontend consumes aggregated status unchanged

- **WHEN** a client requests `/api/status` in GitHub mode
- **THEN** the response SHALL contain the same provider, windows, cost, and activity structure as local mode

### Requirement: Resilient remote fetch

The system SHALL remain resilient when the remote source is unavailable. On fetch failure the system SHALL carry forward the last successful snapshot and mark it stale, and `/api/status` MUST NOT return HTTP 500. The top-level snapshot SHALL be marked stale when the freshest device `generatedAt` exceeds a configured staleness threshold.

#### Scenario: Fetch failure carries forward last snapshot

- **WHEN** the remote fetch fails and a previous snapshot exists
- **THEN** the system SHALL serve the previous snapshot marked as stale and SHALL NOT return a 500 error

#### Scenario: Stale when data is too old

- **WHEN** the freshest device `generatedAt` is older than the staleness threshold
- **THEN** the aggregated snapshot SHALL be marked stale
