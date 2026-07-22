# render-efficiency Specification

## Purpose

TBD - created by archiving change 'dashboard-v2-enhancements'. Update Purpose after archive.

## Requirements

### Requirement: Skip unchanged DOM rebuilds on poll

During the client-side poll, the dashboard SHALL NOT rebuild the quota-ring and cost DOM when the underlying quota/cost data is unchanged. It SHALL compare a per-column signature of `{ windows, cost }` against the last rendered signature and skip the SVG rebuild when equal. The activity text and the "更新於 X 分鐘前" freshness text SHALL still update every poll via `textContent`.

#### Scenario: No flicker when data unchanged

- **GIVEN** the quota and cost values have not changed since the last poll
- **WHEN** the next 5-second poll runs
- **THEN** the quota-ring SVG nodes SHALL NOT be rebuilt, so the ring does not visibly flicker

#### Scenario: Rings update only when data changes

- **GIVEN** the quota percentage changed on the server
- **WHEN** the next poll delivers the new value
- **THEN** the dashboard SHALL rebuild the affected column's rings to reflect the new value


<!-- @trace
source: dashboard-v2-enhancements
updated: 2026-07-22
code:
  - src/public/index.html
-->

---
### Requirement: Minimal pet DOM updates

The dashboard SHALL change the pet element's animation class or `background-image` only when the activity state or the selected pet id has changed, tracking the last-applied activity and pet id per column.

#### Scenario: Pet untouched when nothing changed

- **GIVEN** a column's activity and selected pet are the same as the previous poll
- **WHEN** the next poll runs
- **THEN** the dashboard SHALL NOT reassign the pet's class or background image, avoiding animation restarts

<!-- @trace
source: dashboard-v2-enhancements
updated: 2026-07-22
code:
  - src/public/index.html
-->