## ADDED Requirements

### Requirement: Two-column dashboard layout

The dashboard SHALL be a single self-contained `index.html` with inline CSS/JS, no framework and no charting library, presenting two columns (Claude Code and Codex). Each column SHALL contain a pet animation, two quota rings (5hr session and weekly), today/this-week cost, and a status line.

#### Scenario: Both providers rendered

- **WHEN** the page renders a valid status payload
- **THEN** each column SHALL display its two quota rings, cost figures, and status text

#### Scenario: Cost labeled as local estimate

- **WHEN** cost figures are displayed
- **THEN** they SHALL be annotated as "本機推算", while the quota rings SHALL NOT carry that annotation

### Requirement: Pet animation states

The dashboard SHALL use petdex sprite assets to reflect activity: idle frame for `idle`, wave/run frames for `working`, and an idle frame overlaid with a CSS/emoji "😴 Zzz" effect for `exhausted`.

#### Scenario: Sleeping when exhausted

- **WHEN** a provider activity is `exhausted`
- **THEN** the pet SHALL display the idle frame with the sleeping overlay

### Requirement: Client-side polling

The dashboard SHALL fetch `/api/status` every 5 seconds and update the DOM in place without a full page reload, and SHALL display a "更新於 X 分鐘前" freshness indicator.

#### Scenario: Live activity update

- **GIVEN** a provider transitions from idle to working on the server
- **WHEN** the next 5-second poll completes
- **THEN** the corresponding pet SHALL switch to the working animation without page reload

### Requirement: iPhone full-screen support

The page SHALL include `apple-mobile-web-app-capable` meta and an `apple-touch-icon` so that adding it to the iPhone home screen yields a full-screen app.

#### Scenario: Added to home screen

- **WHEN** the page is added to the iPhone home screen and launched
- **THEN** it SHALL open full-screen without Safari chrome
