# usage-reports Specification

## Purpose

TBD - created by archiving change 'dashboard-launcher-reports'. Update Purpose after archive.

## Requirements

### Requirement: Consolidated usage report view

The system SHALL provide a single usage-report view at `#/usage` with a period selector offering this week, this month, and custom range. It SHALL render a **stacked area chart** of daily cost broken down per tool (client), using the single vendored charting library. Data comes from `GET /api/usage/daily?range=week|month` (this week / this month) and `GET /api/usage/custom?since=&until=` (custom), where each daily point carries per-client cost under `byClient`.

#### Scenario: Default period is this week

- **WHEN** the user opens `#/usage`
- **THEN** the system SHALL fetch `GET /api/usage/daily?range=week` and render a stacked area chart with one series per tool

#### Scenario: Switching period

- **WHEN** the user changes the period selector to this month
- **THEN** the system SHALL fetch `GET /api/usage/daily?range=month` and re-render the stacked area chart

#### Scenario: Custom range

- **WHEN** the user selects the custom period and supplies a valid `since` and `until` (`YYYY-MM-DD`, `since <= until`)
- **THEN** the system SHALL fetch `GET /api/usage/custom?since=&until=` and render it; invalid dates SHALL show an inline hint and SHALL NOT issue the request

#### Scenario: Per-tool stacked series

- **WHEN** a day's data includes cost for more than one tool
- **THEN** each tool SHALL be a distinct stacked area series with its own colour and a legend entry

#### Scenario: Empty state on data failure

- **WHEN** the report API returns `{ ok: false }` or no points
- **THEN** the view SHALL show an empty state rather than a broken chart


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
### Requirement: Tool-share breakdown

The system SHALL provide a doughnut chart at `#/pie` of cost share from `GET /api/usage/models`, with a group-by selector switching between **by tool (client)** and **by model**.

#### Scenario: Group by tool

- **WHEN** the group-by selector is set to tool
- **THEN** the system SHALL aggregate `entries[].cost` by `client` and render one slice per tool

#### Scenario: Group by model

- **WHEN** the group-by selector is set to model
- **THEN** the system SHALL aggregate `entries[].cost` by `model` and render one slice per model


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
### Requirement: Contribution heatmap

The system SHALL render a contribution heatmap at `#/heatmap` as a CSS grid (7 rows × weeks, aligned to Sunday) coloured by the `intensity` (0–4) values from `GET /api/usage/graph?range=year`, without a third-party charting library.

#### Scenario: Heatmap rendered

- **WHEN** the user opens `#/heatmap` and graph data is available
- **THEN** the system SHALL render a day-cell grid coloured by intensity from earliest to latest returned date

#### Scenario: Empty state

- **WHEN** the graph API returns no points
- **THEN** the view SHALL show an empty state


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
### Requirement: Report data caching

The system SHALL serve report data through a caching layer that applies a short TTL and serializes concurrent in-flight requests for the same key, so that repeated or rapid report requests do not spawn one tokscale process each.

#### Scenario: Cached within TTL

- **WHEN** the same report is requested twice within the TTL window
- **THEN** the second request SHALL be served from cache without spawning a new tokscale process

#### Scenario: Concurrent requests coalesced

- **WHEN** two identical report requests arrive while a fetch is in flight
- **THEN** both SHALL share the single in-flight result rather than spawning two processes

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