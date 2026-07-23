# dashboard-ui Specification

## Purpose

TBD - created by archiving change 'ai-status-dashboard'. Update Purpose after archive.

## Requirements

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

---
### Requirement: Pet animation states

The dashboard SHALL use petdex sprite assets to reflect activity: idle frame for `idle`, wave/run frames for `working`, and an idle frame overlaid with a CSS/emoji "😴 Zzz" effect for `exhausted`.

#### Scenario: Sleeping when exhausted

- **WHEN** a provider activity is `exhausted`
- **THEN** the pet SHALL display the idle frame with the sleeping overlay


<!-- @trace
source: ai-status-dashboard
updated: 2026-07-22
code:
  - src/public/index.html
-->

---
### Requirement: Client-side polling

The dashboard SHALL fetch `/api/status` every 5 seconds and update the DOM in place without a full page reload, and SHALL display a "更新於 X 分鐘前" freshness indicator.

#### Scenario: Live activity update

- **GIVEN** a provider transitions from idle to working on the server
- **WHEN** the next 5-second poll completes
- **THEN** the corresponding pet SHALL switch to the working animation without page reload


<!-- @trace
source: ai-status-dashboard
updated: 2026-07-22
code:
  - src/public/index.html
-->

---
### Requirement: iPhone full-screen support

The page SHALL include `apple-mobile-web-app-capable` meta and an `apple-touch-icon` so that adding it to the iPhone home screen yields a full-screen app.

#### Scenario: Added to home screen

- **WHEN** the page is added to the iPhone home screen and launched
- **THEN** it SHALL open full-screen without Safari chrome

<!-- @trace
source: ai-status-dashboard
updated: 2026-07-22
code:
  - src/public/index.html
-->

---
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

---
### Requirement: Route-aware status polling

The dashboard SHALL run the existing 5-second `GET /api/status` polling only while the active route is `#/` or `#/today`, and SHALL pause that polling on report routes, fetching the relevant report API instead.

#### Scenario: Polling paused on report views

- **WHEN** the active route is a report view such as `#/weekly` or `#/heatmap`
- **THEN** the 5-second `/api/status` polling SHALL be paused

#### Scenario: Polling resumes on today

- **WHEN** the route returns to `#/today`
- **THEN** the 5-second `/api/status` polling SHALL resume

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

---
### Requirement: Landscape reflow on short wide viewports

The dashboard SHALL reflow each `#/today` card from a vertical stack into a horizontal layout when the viewport is short and wide, so the cards fit without clipping and without shrinking their contents. This behavior SHALL activate when the viewport height is at most 520px AND the viewport width is at least 640px. Under these conditions each card SHALL place its pet stage on the left and its quota rings, cost figures, cost note, and status line on the right, while the two provider cards SHALL remain side by side within the same view. The pet stage SHALL retain its normal size (no reduction) in this layout.

When the viewport does not meet both conditions (taller than 520px, or narrower than 640px), the cards SHALL retain the pre-existing vertical stacked layout.

#### Scenario: Short wide viewport reflows to horizontal

- **WHEN** the `#/today` view renders on a viewport with height ≤ 520px and width ≥ 640px (e.g. 932×430 landscape)
- **THEN** each card SHALL render horizontally with the pet on the left and rings, cost, and status on the right, both cards side by side, the pet at normal size, and all cost figures and status fully visible without clipping

#### Scenario: Reflow avoids scaling at normal short height

- **WHEN** the horizontal reflow is active and the content fits within the available height
- **THEN** no `transform: scale()` reduction SHALL be applied (scale remains 1), so the pet and text render at full size

#### Scenario: Tall or narrow viewport keeps vertical layout

- **WHEN** the viewport height exceeds 520px or the width is below 640px
- **THEN** the cards SHALL retain the vertical stacked layout unchanged from prior behavior


<!-- @trace
source: fit-cards-short-screen
updated: 2026-07-23
code:
  - .serena/project.yml
  - src/public/index.html
-->

---
### Requirement: Fit-to-height scaling as short-viewport fallback

The dashboard SHALL keep the active view's content fully visible when the viewport height is insufficient even after any layout reflow, by applying uniform CSS `transform: scale()` to the view's primary container so no content is clipped. This behavior SHALL apply only to the `#/today` view (its `.grid` container) and the launcher home view (its `.tiles` container); other views SHALL NOT be scaled.

The scale factor SHALL be computed as `min(1, availableHeight / naturalContentHeight)`, where `naturalContentHeight` is measured with any existing transform cleared and reflects the current layout (including landscape reflow when active). When the computed factor is greater than or equal to 1, the container transform SHALL be cleared so sufficiently tall viewports render identically to the pre-existing layout. No minimum scale floor SHALL be enforced.

The available height SHALL be derived from the layout viewport (`document.documentElement.clientHeight`), not from `window.innerHeight`, so that mobile pinch-to-zoom (which pollutes `innerHeight` with the zoomed visual-viewport height on some browsers) does not distort the computed scale.

On orientation change the dashboard SHALL reset any active pinch-to-zoom back to the default initial scale, so the user does not have to manually pinch-zoom back after rotating. The reset SHALL be transient (zoom is snapped to the default, then user zooming is re-enabled) rather than permanently disabling zoom.

The scale SHALL be recomputed on window resize, on orientation change, on route entry into the affected views, whenever the container's content size changes (including asynchronous poll-driven rendering of rings and cost figures), and whenever the visual viewport changes (pinch zoom or visual-viewport scroll). On orientation change the recompute SHALL be deferred until after the viewport dimensions settle.

#### Scenario: Proportion recovers after pinch zoom and rotation

- **WHEN** the user pinch-zooms in portrait and then rotates back to landscape
- **THEN** the container scale SHALL be recomputed from the layout viewport so the layout returns to its correct proportion rather than remaining stuck at a zoom-distorted scale

#### Scenario: Rotation resets zoom to default

- **WHEN** the user has pinch-zoomed and then rotates the device
- **THEN** the pinch zoom SHALL be reset to the default initial scale automatically, and the user SHALL still be able to pinch-zoom again afterward

#### Scenario: Extremely short viewport scales down as fallback

- **WHEN** the `#/today` view renders on a viewport so short that the content does not fit even after reflow (e.g. 932×300)
- **THEN** the `.grid` container SHALL be scaled down so the cost figures, cost note, and status line remain fully visible without clipping

#### Scenario: Tall viewport is unchanged

- **WHEN** the viewport height is sufficient to fit the content at natural size
- **THEN** the computed scale SHALL be 1 and no transform SHALL be applied, leaving the layout identical to the prior behavior

#### Scenario: Launcher scales on short viewport

- **WHEN** the launcher home view renders on a viewport too short to fit all tiles
- **THEN** the `.tiles` container SHALL be scaled down so every tile is fully visible

#### Scenario: Rescale after asynchronous render

- **WHEN** poll-driven content (quota rings or cost figures) renders and changes the container height
- **THEN** the scale SHALL be recomputed so the content remains fully visible without clipping

<!-- @trace
source: fit-cards-short-screen
updated: 2026-07-23
code:
  - .serena/project.yml
  - src/public/index.html
-->