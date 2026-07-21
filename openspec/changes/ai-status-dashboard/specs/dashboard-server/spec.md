## ADDED Requirements

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
