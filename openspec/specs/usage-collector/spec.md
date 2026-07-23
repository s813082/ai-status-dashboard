# usage-collector Specification

## Purpose

TBD - created by archiving change 'ai-status-dashboard'. Update Purpose after archive.

## Requirements

### Requirement: Provider filtering

The system SHALL retain only the providers declared in a central provider configuration, ignoring any provider not listed there. The configuration SHALL describe each provider with an identifier, its tokscale client name, its tokscale usage-provider name (when applicable), its quota source, a display name, and a colour, so that adding a new provider requires only appending one entry.

#### Scenario: Only configured providers retained

- **GIVEN** the central provider configuration declares `claude` and `codex`
- **WHEN** the system normalizes tokscale results that also include other clients
- **THEN** only the `claude` and `codex` provider entries SHALL appear in the stored snapshot

#### Scenario: Adding a provider is a single-entry change

- **GIVEN** a new provider entry is appended to the central provider configuration
- **WHEN** the collector next normalizes results
- **THEN** that provider SHALL be retained and normalized without further code changes to the collector


<!-- @trace
source: swap-tokscale-backend
updated: 2026-07-22
code:
  - src/public/index.html
  - package.json
  - launchd/com.barry.ai-status-dashboard.plist
  - src/collectors/tokscaleSnapshot.js
  - src/collectors/tokscale.js
  - src/server.js
  - src/providers.js
-->

---
### Requirement: File-mtime activity detection

The system SHALL determine each provider's activity state using only file modification times, and SHALL NOT use process (`ps`) inspection. It SHALL scan the latest mtime among `~/.claude/projects/**/*.jsonl` for Claude and `~/.codex/sessions/**/*.jsonl` for Codex, and compute the state on each `/api/status` request rather than on a separate timer.

#### Scenario: Recent write means working

- **GIVEN** the latest matching `.jsonl` mtime is 20 seconds ago
- **WHEN** activity is computed
- **THEN** the provider activity SHALL be `working`

#### Scenario: No recent write means idle

- **GIVEN** the latest matching `.jsonl` mtime is 120 seconds ago
- **WHEN** activity is computed
- **THEN** the provider activity SHALL be `idle`

#### Scenario: Exhausted quota overrides

- **GIVEN** any window of the provider reports `remainingPercent` at rock bottom
- **WHEN** activity is computed
- **THEN** the provider activity SHALL be `exhausted` regardless of mtime

##### Example: activity thresholds

| Latest mtime age | remainingPercent | Activity |
| ---------------- | ---------------- | -------- |
| 20s              | 40               | working  |
| 120s             | 40               | idle     |
| 120s             | 0                | exhausted |

<!-- @trace
source: ai-status-dashboard
updated: 2026-07-22
code:
  - src/public/index.html
-->

---
### Requirement: tokscale CLI quota and cost collection

The system SHALL collect quota and cost data by invoking the tokscale CLI every 60 seconds, and SHALL normalize the results into the existing per-provider snapshot contract: each retained provider exposes `windows[]` (each `{ kind, usedPercent, remainingPercent, resetAt }` with `kind` in `session` or `weekly`) and `cost` (`{ todayUSD, last30DaysUSD }`). Quota values SHALL be vendor-reported values returned by tokscale, not inferred from local logs.

#### Scenario: Claude quota from usage command

- **WHEN** the system runs `tokscale usage --json` and finds an entry with `provider == "Claude"`
- **THEN** the system SHALL map the metric labelled `Session` to a window with `kind: session` and the metric labelled `Weekly` to a window with `kind: weekly`, copying `used_percent`, `remaining_percent`, and `resets_at` into `usedPercent`, `remainingPercent`, and `resetAt`

#### Scenario: Codex quota from codex status command

- **WHEN** the system runs `tokscale codex status --json` and receives a successful response
- **THEN** the system SHALL map the metric labelled `5h` to a single window with `kind: weekly` — because its `resets_at` is roughly a week out, so it is a weekly-horizon quota rather than a 5-hour window — and SHALL NOT synthesize a `session` window, leaving the Codex 5-hour ring in a "no data" state

#### Scenario: Cost derived from graph summary

- **WHEN** the system runs `tokscale graph -c <client> --today` and `tokscale graph -c <client> --since <current day minus 29 days>`
- **THEN** the system SHALL set `cost.todayUSD` from the `--today` invocation's `summary.totalCost` and `cost.last30DaysUSD` from the `--since` invocation's `summary.totalCost`


<!-- @trace
source: swap-tokscale-backend
updated: 2026-07-22
code:
  - src/public/index.html
  - package.json
  - launchd/com.barry.ai-status-dashboard.plist
  - src/collectors/tokscaleSnapshot.js
  - src/collectors/tokscale.js
  - src/server.js
  - src/providers.js
-->

---
### Requirement: tokscale CLI collection resilience

The system SHALL keep the server process alive and the `/api/status` response non-erroring under all tokscale CLI failure modes, degrading to explicit empty or "no data" states rather than crashing or emitting wrong values. All tokscale invocations SHALL pass through a single access wrapper that executes tokscale via `execFile` with a timeout and bounded output buffer, and report-style commands SHALL pass `--no-spinner`.

#### Scenario: tokscale not installed

- **WHEN** invoking tokscale fails with `ENOENT`
- **THEN** the system SHALL mark the snapshot with an `error`, leave `windows` and `cost` empty, reuse the last persisted `data/snapshot.json` if present, and expose a state the UI can render as an installation banner — without terminating the process

#### Scenario: Codex authorization failure isolated

- **WHEN** `tokscale codex status --json` returns an object containing `error` or fails with HTTP 401
- **THEN** the `codex` provider SHALL have an empty `windows` array and a recorded `error`, and the `claude` provider data SHALL remain unaffected

#### Scenario: Parse failure or schema drift degrades gracefully

- **WHEN** tokscale stdout fails to parse as JSON, or an expected field or metric label is missing
- **THEN** the system SHALL use defensive field access so that an unmappable metric renders as "no data" for that window, and a total collection failure SHALL reuse the last snapshot marked `stale: true`

#### Scenario: Missing cost yields null

- **WHEN** a `tokscale graph` invocation returns no `summary.totalCost` for the requested client
- **THEN** the corresponding `cost.todayUSD` or `cost.last30DaysUSD` SHALL be `null`

<!-- @trace
source: swap-tokscale-backend
updated: 2026-07-22
code:
  - src/public/index.html
  - package.json
  - launchd/com.barry.ai-status-dashboard.plist
  - src/collectors/tokscaleSnapshot.js
  - src/collectors/tokscale.js
  - src/server.js
  - src/providers.js
-->