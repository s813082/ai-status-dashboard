# quota-alerts Specification

## Purpose

TBD - created by archiving change 'dashboard-launcher-reports'. Update Purpose after archive.

## Requirements

### Requirement: Weekly quota threshold alerting

The system SHALL alert when a provider's weekly window `usedPercent` reaches the configured threshold (default 85%). On a secure origin (desktop/localhost) it SHALL use the Notification API; when the Notification API is unavailable or permission is denied (for example an iPhone on a LAN http origin), it SHALL degrade to an in-page fixed banner. Each alert SHALL fire at most once per `resetAt` cycle.

#### Scenario: Desktop notification on secure origin

- **WHEN** `weekly.usedPercent` reaches the configured threshold and the Notification API is available and permitted
- **THEN** the system SHALL display a desktop notification

#### Scenario: Banner fallback on insecure origin

- **WHEN** the threshold is reached but the Notification API is unavailable or permission is denied
- **THEN** the system SHALL display an in-page fixed banner instead

#### Scenario: One alert per reset cycle

- **WHEN** the threshold remains exceeded across multiple polls within the same `resetAt` cycle
- **THEN** the system SHALL alert only once for that cycle

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