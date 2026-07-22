## ADDED Requirements

### Requirement: Usage report endpoints

The server SHALL expose read-only usage report endpoints that never return HTTP 500: `GET /api/usage/daily?range=week|month`, `GET /api/usage/monthly`, `GET /api/usage/models`, `GET /api/usage/graph?range=year|month`, and `GET /api/usage/custom?since=&until=`. Each SHALL return `{ ok: true, data }` on success and `{ ok: false, error, data: null }` on failure, with `Cache-Control: no-store`.

#### Scenario: Report endpoint returns data envelope

- **WHEN** a client requests `GET /api/usage/monthly` and the underlying data is available
- **THEN** the server SHALL return `{ ok: true, data }` with HTTP 200

#### Scenario: Report endpoint degrades on failure

- **WHEN** the underlying tokscale invocation fails
- **THEN** the server SHALL return `{ ok: false, error, data: null }` with HTTP 200 rather than crashing or returning 500

#### Scenario: Custom range input validation

- **WHEN** `GET /api/usage/custom` receives a `since` or `until` that is not a `YYYY-MM-DD` date, or a range exceeding the allowed span
- **THEN** the server SHALL reject the request without spawning tokscale

### Requirement: Settings endpoints

The server SHALL expose `GET /api/settings` returning the current settings object and `POST /api/settings` accepting a partial update, persisting to `data/settings.json`, and returning the merged result.

#### Scenario: Read settings

- **WHEN** a client requests `GET /api/settings`
- **THEN** the server SHALL return the current settings object

#### Scenario: Update settings persists

- **WHEN** a client sends `POST /api/settings` with a partial update
- **THEN** the server SHALL merge and persist it to `data/settings.json` and return the merged object

#### Scenario: Persist failure keeps previous values

- **WHEN** persisting settings fails
- **THEN** the server SHALL retain the previous values and return an error rather than crashing

### Requirement: Vendor static route

The server SHALL serve local vendored assets at `GET /vendor/<asset>` from `src/public/vendor/` with path-traversal protection equivalent to the existing `/pets/` route.

#### Scenario: Vendored chart library served

- **WHEN** a client requests `GET /vendor/chart.umd.min.js`
- **THEN** the server SHALL return the file from `src/public/vendor/` with HTTP 200

#### Scenario: Path traversal rejected

- **WHEN** a client requests a `/vendor/` path that escapes the vendor directory
- **THEN** the server SHALL reject the request
