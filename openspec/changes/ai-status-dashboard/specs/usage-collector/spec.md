## ADDED Requirements

### Requirement: CodexBar snapshot polling

The system SHALL poll the local `codexbar serve` endpoint `GET http://127.0.0.1:8080/dashboard/v1/snapshot` every 60 seconds with an `Authorization: Bearer <token>` header, where the token is read from the `CODEXBAR_DASHBOARD_TOKEN` environment variable.

#### Scenario: Successful snapshot fetch

- **WHEN** the poll succeeds and returns a recognized `schemaVersion`
- **THEN** the system stores the normalized snapshot in memory and persists it to `data/snapshot.json`

#### Scenario: Fetch failure falls back to cache

- **WHEN** the poll fails (connection refused, timeout, 401, or 429)
- **THEN** the system SHALL reuse the last persisted snapshot and mark it `stale: true`, and SHALL NOT implement its own backoff or retry logic

### Requirement: Provider filtering

The system SHALL only retain providers where `id === "codex"` or `id === "claude"`, ignoring all other providers.

#### Scenario: Extra providers ignored

- **GIVEN** a snapshot whose `providers[]` includes `gemini` and `openrouter` entries reporting errors
- **WHEN** the system normalizes the snapshot
- **THEN** only the `codex` and `claude` provider entries SHALL appear in the stored snapshot

### Requirement: Schema version validation

The system SHALL validate the snapshot `schemaVersion` and fail loudly on unrecognized versions rather than displaying wrong numbers silently.

#### Scenario: Unrecognized schema version

- **WHEN** the snapshot `schemaVersion` is not a recognized value
- **THEN** the stored snapshot SHALL be marked `formatError: true` so the UI can display a "資料格式不符" message instead of numeric values

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
