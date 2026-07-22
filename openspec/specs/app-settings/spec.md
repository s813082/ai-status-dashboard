# app-settings Specification

## Purpose

TBD - created by archiving change 'dashboard-launcher-reports'. Update Purpose after archive.

## Requirements

### Requirement: Persisted user settings

The system SHALL persist user settings in `data/settings.json` with read/write resilience equivalent to `pet-config.json`, covering poll interval, language, theme, screen keep-awake, per-provider visibility, pet selection, and per-provider cost budget with alert threshold. The settings page SHALL be the `#/settings` view.

#### Scenario: Settings applied on load

- **WHEN** the dashboard loads
- **THEN** it SHALL apply the persisted language, theme, poll interval, and provider visibility from `data/settings.json`

#### Scenario: Theme manual override

- **WHEN** the user selects a theme of light, dark, or auto on the settings page
- **THEN** the dashboard SHALL apply that theme, overriding the `prefers-color-scheme` default when light or dark is chosen

#### Scenario: Provider visibility toggle

- **WHEN** the user disables a provider on the settings page
- **THEN** that provider's card SHALL be hidden on the `#/today` view

#### Scenario: Screen keep-awake migrated

- **WHEN** the user toggles screen keep-awake on the settings page
- **THEN** the existing wake-lock behavior SHALL be controlled from the settings view and the preference SHALL persist

#### Scenario: Budget and threshold stored

- **WHEN** the user sets a per-provider budget and alert threshold
- **THEN** the values SHALL persist and be available to the quota-alert logic

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
  - src/collectors/codexBarSnapshot.js
  - src/collectors/tokscale.js
  - src/public/vendor/chart.umd.min.js
  - README.md
  - src/providers.js
  - launchd/com.barry.codexbar-serve.plist
  - src/collectors/tokscaleSnapshot.js
-->