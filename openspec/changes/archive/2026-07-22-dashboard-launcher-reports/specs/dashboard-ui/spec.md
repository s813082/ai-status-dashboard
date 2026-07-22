## ADDED Requirements

### Requirement: Launcher home page and hash routing

The dashboard SHALL provide a Launcher home page at hash route `#/` presenting navigation entries to all views, and SHALL switch views within the single `index.html` using hash-based routing over the routes `#/`, `#/today`, `#/usage`, `#/pie`, `#/heatmap`, `#/alerts`, and `#/settings`. The `#/usage` view consolidates weekly, monthly, and custom-range reports behind a period selector. The existing quota-ring main screen SHALL become the `#/today` view with its markup and behavior unchanged.

#### Scenario: Launcher shown by default

- **WHEN** the page loads with no hash or with `#/`
- **THEN** the Launcher home page SHALL be shown with selectable entries for today, usage reports, tool-share pie, heatmap, alerts, and settings

#### Scenario: Today view preserves existing screen

- **WHEN** the route is `#/today`
- **THEN** the existing two-column quota rings, cost figures, status text, and pet animation SHALL render exactly as before this change

#### Scenario: Navigating between views

- **WHEN** the hash changes to a known route
- **THEN** only the matching view section SHALL be visible and all others SHALL be hidden

### Requirement: Route-aware status polling

The dashboard SHALL run the existing 5-second `GET /api/status` polling only while the active route is `#/` or `#/today`, and SHALL pause that polling on report routes, fetching the relevant report API instead.

#### Scenario: Polling paused on report views

- **WHEN** the active route is a report view such as `#/weekly` or `#/heatmap`
- **THEN** the 5-second `/api/status` polling SHALL be paused

#### Scenario: Polling resumes on today

- **WHEN** the route returns to `#/today`
- **THEN** the 5-second `/api/status` polling SHALL resume

## MODIFIED Requirements

### Requirement: Two-column dashboard layout

The dashboard SHALL be a single self-contained `index.html` with inline CSS/JS and no framework. It MAY load exactly one vendored charting library from the local `/vendor/` path (no CDN); no other runtime front-end dependency is permitted. The two-column view (Claude Code and Codex) — each column containing a pet animation, two quota rings (5hr session and weekly), today/this-week cost, and a status line — SHALL be presented as the `#/today` route within the hash router rather than as the whole page.

#### Scenario: Both providers rendered

- **WHEN** the `#/today` view renders a valid status payload
- **THEN** each column SHALL display its two quota rings, cost figures, and status text

#### Scenario: Cost labeled as local estimate

- **WHEN** cost figures are displayed
- **THEN** they SHALL be annotated as "本機推算", while the quota rings SHALL NOT carry that annotation

#### Scenario: Charting library loaded locally

- **WHEN** a view needs the charting library
- **THEN** it SHALL be loaded from `/vendor/` and SHALL NOT be fetched from any external origin
