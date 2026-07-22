# launchd-daemon Specification

## Purpose

TBD - created by archiving change 'ai-status-dashboard'. Update Purpose after archive.

## Requirements

### Requirement: CodexBar serve daemon

The system SHALL provide a launchd plist `com.barry.codexbar-serve` that runs `/opt/homebrew/bin/codexbar serve --host 127.0.0.1 --port 8080 --refresh-interval 60` with `RunAtLoad` and `KeepAlive` enabled, passing `CODEXBAR_DASHBOARD_TOKEN` via `EnvironmentVariables`, logging to `logs/codexbar-serve.out.log` and `logs/codexbar-serve.err.log`.

#### Scenario: Runs on load and stays alive

- **WHEN** the plist is loaded
- **THEN** launchd SHALL start `codexbar serve` immediately and restart it if it exits


<!-- @trace
source: ai-status-dashboard
updated: 2026-07-22
code:
  - src/public/index.html
-->

---
### Requirement: Dashboard server daemon

The system SHALL provide a launchd plist `com.barry.ai-status-dashboard` that runs the nvm node absolute path against `src/server.js` with `WorkingDirectory` set to the project root, `RunAtLoad` and `KeepAlive` enabled, `CODEXBAR_DASHBOARD_TOKEN` via `EnvironmentVariables`, logging to `logs/out.log` and `logs/err.log`.

#### Scenario: Absolute node path

- **WHEN** launchd starts the dashboard server
- **THEN** the plist SHALL use the absolute nvm node path (not a shim), because launchd does not load `.zshrc`/nvm


<!-- @trace
source: ai-status-dashboard
updated: 2026-07-22
code:
  - src/public/index.html
-->

---
### Requirement: Token stays out of version control

The plists committed to git SHALL contain a placeholder token, and the real token SHALL be supplied via a non-versioned local plist or environment variable.

#### Scenario: No plaintext token in repo

- **WHEN** the repository is scanned for secrets
- **THEN** no plaintext token SHALL appear in any versioned file and the committed plists SHALL contain a placeholder

<!-- @trace
source: ai-status-dashboard
updated: 2026-07-22
code:
  - src/public/index.html
-->