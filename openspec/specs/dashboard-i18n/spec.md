# dashboard-i18n Specification

## Purpose

TBD - created by archiving change 'dashboard-launcher-reports'. Update Purpose after archive.

## Requirements

### Requirement: Traditional Chinese and English localization

The dashboard SHALL support Traditional Chinese (`tw`) and English (`en`) via a string table in `src/public/i18n.js`, applying static text through `data-i18n` attributes and dynamic text through a `t(key)` lookup, replacing the previously hard-coded Traditional Chinese strings. The selected language SHALL persist and default to `tw`.

#### Scenario: Default language

- **WHEN** no language preference is stored
- **THEN** the dashboard SHALL render in Traditional Chinese (`tw`)

#### Scenario: Switching language re-renders text

- **WHEN** the user switches the language between `tw` and `en`
- **THEN** all `data-i18n` static text and `t(key)` dynamic text SHALL update to the selected language without a full page reload

#### Scenario: Language preference persists

- **WHEN** the user selects a language and reloads
- **THEN** the previously selected language SHALL be applied

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