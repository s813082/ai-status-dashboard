# dashboard-server Specification

## Purpose

TBD - created by archiving change 'ai-status-dashboard'. Update Purpose after archive.

## Requirements

### Requirement: HTTP server and routes

The system SHALL run a `node:http` server listening on port 8787 that serves three routes without any web framework.

#### Scenario: Root serves dashboard page

- **WHEN** a client requests `GET /`
- **THEN** the server SHALL return the self-contained `src/public/index.html`

#### Scenario: Static pet assets

- **WHEN** a client requests `GET /pets/<asset>`
- **THEN** the server SHALL return the corresponding static file from `src/public/pets/`

#### Scenario: Status API

- **WHEN** a client requests `GET /api/status`
- **THEN** the server SHALL return the in-memory latest quota/cost snapshot combined with freshly computed per-provider activity, without triggering a live fetch to `codexbar serve`


<!-- @trace
source: ai-status-dashboard
updated: 2026-07-22
code:
  - src/public/index.html
-->

---
### Requirement: Resilient status responses

The `/api/status` route SHALL never return HTTP 500 or crash due to collector failure.

#### Scenario: CodexBar unavailable

- **GIVEN** `codexbar serve` is stopped
- **WHEN** a client requests `GET /api/status`
- **THEN** the server SHALL return the last cached snapshot with a stale/disconnected marker and HTTP 200

#### Scenario: No cache available on cold start

- **GIVEN** no `data/snapshot.json` exists and `codexbar serve` is not yet ready
- **WHEN** a client requests `GET /api/status`
- **THEN** the server SHALL return a loading state with HTTP 200 and SHALL NOT crash

<!-- @trace
source: ai-status-dashboard
updated: 2026-07-22
code:
  - src/public/index.html
-->

---
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


<!-- @trace
source: dashboard-launcher-reports
updated: 2026-07-22
code:
  - src/public/i18n.js
  - src/server.js
  - package.json
  - src/public/index.html
  - src/collectors/tokscaleReports.js
  - launchd/com.barry.ai-status-dashboard.plist
  - src/collectors/tokscale.js
  - src/public/vendor/chart.umd.min.js
  - README.md
  - src/providers.js
  - src/collectors/tokscaleSnapshot.js
-->

---
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


<!-- @trace
source: dashboard-launcher-reports
updated: 2026-07-22
code:
  - src/public/i18n.js
  - src/server.js
  - package.json
  - src/public/index.html
  - src/collectors/tokscaleReports.js
  - launchd/com.barry.ai-status-dashboard.plist
  - src/collectors/tokscale.js
  - src/public/vendor/chart.umd.min.js
  - README.md
  - src/providers.js
  - src/collectors/tokscaleSnapshot.js
-->

---
### Requirement: Vendor static route

The server SHALL serve local vendored assets at `GET /vendor/<asset>` from `src/public/vendor/` with path-traversal protection equivalent to the existing `/pets/` route.

#### Scenario: Vendored chart library served

- **WHEN** a client requests `GET /vendor/chart.umd.min.js`
- **THEN** the server SHALL return the file from `src/public/vendor/` with HTTP 200

#### Scenario: Path traversal rejected

- **WHEN** a client requests a `/vendor/` path that escapes the vendor directory
- **THEN** the server SHALL reject the request

<!-- @trace
source: dashboard-launcher-reports
updated: 2026-07-22
code:
  - src/public/i18n.js
  - src/server.js
  - package.json
  - src/public/index.html
  - src/collectors/tokscaleReports.js
  - launchd/com.barry.ai-status-dashboard.plist
  - src/collectors/tokscale.js
  - src/public/vendor/chart.umd.min.js
  - README.md
  - src/providers.js
  - src/collectors/tokscaleSnapshot.js
-->