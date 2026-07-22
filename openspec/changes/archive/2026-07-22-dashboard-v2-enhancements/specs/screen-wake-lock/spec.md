## ADDED Requirements

### Requirement: Screen wake lock to keep display awake

The dashboard SHALL use the Screen Wake Lock API (`navigator.wakeLock.request('screen')`) to keep the device screen awake while the page is visible, and SHALL re-acquire the lock on `visibilitychange` when the page returns to visible (because the lock is auto-released when the page is hidden).

#### Scenario: Re-acquire on return to foreground

- **GIVEN** the wake lock was auto-released when the page was hidden
- **WHEN** the page becomes visible again and the toggle is on
- **THEN** the dashboard SHALL request the screen wake lock again

### Requirement: Wake lock toggle defaulting on

The dashboard SHALL provide a "🔆 恆亮" toggle inside the gear panel that defaults to on. When turned off, the dashboard SHALL release the wake lock.

#### Scenario: Toggle off releases lock

- **WHEN** the user turns the 恆亮 toggle off
- **THEN** the dashboard SHALL release the current wake lock and SHALL NOT re-acquire it until turned on again

### Requirement: Graceful degradation when unsupported

The dashboard SHALL feature-detect `navigator.wakeLock` and, when it is absent or a request fails, SHALL continue rendering without error and SHALL NOT introduce any third-party fallback library.

#### Scenario: Unsupported browser

- **WHEN** the page runs in a browser where `navigator.wakeLock` is undefined
- **THEN** the dashboard SHALL skip the wake-lock request silently and render normally
