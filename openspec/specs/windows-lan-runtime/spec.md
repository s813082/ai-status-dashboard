# windows-lan-runtime Specification

## Purpose

TBD - created by archiving change 'windows-lan-iphone-support'. Update Purpose after archive.

## Requirements

### Requirement: Windows dashboard startup

The system SHALL provide a Windows PowerShell 5.1-compatible startup script that derives the repository root from its own location, verifies Node.js version 18 or newer, resolves a runnable `tokscale.exe`, `tokscale.cmd`, or `tokscale.bat` while excluding PowerShell shims, sets `TOKSCALE_BIN` for the child process, and starts `src/server.js` from the repository root with hidden background execution and persisted stdout and stderr logs.

#### Scenario: Dashboard starts from any caller working directory

- **WHEN** a user or scheduled task invokes `scripts/windows/start-dashboard.ps1` from a directory outside the repository
- **THEN** the script SHALL derive the repository root from `$PSScriptRoot`, launch Node.js with `src/server.js` in that repository root, and write stdout and stderr beneath the ignored `logs` directory

#### Scenario: Unsupported Node version is rejected

- **WHEN** the resolved Node.js major version is less than 18 or Node.js cannot be resolved
- **THEN** the script SHALL exit non-zero with an actionable message before starting the dashboard

#### Scenario: PowerShell tokscale shim is excluded

- **WHEN** PATH resolution returns a `tokscale.ps1` shim together with a `.cmd`, `.bat`, or `.exe` application
- **THEN** the script SHALL select the application command and SHALL NOT set `TOKSCALE_BIN` to the PowerShell shim

#### Scenario: Existing listener is handled idempotently

- **WHEN** TCP port 8787 is already listening under a Node.js process
- **THEN** the startup script SHALL report the dashboard as already running and SHALL NOT start a duplicate process


<!-- @trace
source: windows-lan-iphone-support
updated: 2026-07-26
code:
  - .agents/skills/spectra-drift/SKILL.md
  - scripts/windows/setup.ps1
  - .agents/skills/spectra-propose/SKILL.md
  - .agents/skills/spectra-archive/SKILL.md
  - .agents/skills/spectra-ask/SKILL.md
  - .agents/skills/spectra-debug/SKILL.md
  - CHANGELOG.md
  - .agents/skills/spectra-apply/SKILL.md
  - README.md
  - .agents/skills/spectra-discuss/SKILL.md
  - .agents/skills/spectra-audit/SKILL.md
  - .agents/skills/spectra-ingest/SKILL.md
  - .agents/skills/spectra-commit/SKILL.md
  - scripts/windows/start-dashboard.ps1
  - package.json
  - src/collectors/tokscale.js
tests:
  - test/tokscale-command.test.js
-->

---
### Requirement: Idempotent Windows setup

The system SHALL provide a `SupportsShouldProcess` setup script that can install global `tokscale@latest` when absent, validate tokscale commands without exposing credentials, create or update one current-user logon task named `AI Status Dashboard`, create or update one same-named Windows Firewall inbound rule, start the task immediately, and verify the dashboard service. Re-running setup SHALL update the named resources without creating duplicates.

#### Scenario: Dry run changes no system state

- **WHEN** the user runs `scripts/windows/setup.ps1 -WhatIf`
- **THEN** the script SHALL list the prospective tokscale installation, scheduled task, Firewall, and startup actions and SHALL NOT install packages, register resources, or start the service

#### Scenario: Missing tokscale is installed globally

- **WHEN** no supported tokscale application command exists and setup runs without `-WhatIf`
- **THEN** setup SHALL invoke npm to install `tokscale@latest` globally and SHALL validate the resolved command with `--version`, `usage --json`, and `codex status --json`

#### Scenario: Provider authorization requires interaction

- **WHEN** a tokscale provider command reports missing or expired authorization
- **THEN** setup SHALL identify the corresponding CLI login or import action as a user task and SHALL NOT request, print, or write any token, password, API key, JWT, or equivalent credential

#### Scenario: Logon task is registered without a stored password

- **WHEN** setup registers or updates the `AI Status Dashboard` task
- **THEN** the task SHALL use the currently logged-in user with an interactive logon token, trigger at user logon, invoke Windows PowerShell 5.1 with `start-dashboard.ps1`, and store no plaintext password


<!-- @trace
source: windows-lan-iphone-support
updated: 2026-07-26
code:
  - .agents/skills/spectra-drift/SKILL.md
  - scripts/windows/setup.ps1
  - .agents/skills/spectra-propose/SKILL.md
  - .agents/skills/spectra-archive/SKILL.md
  - .agents/skills/spectra-ask/SKILL.md
  - .agents/skills/spectra-debug/SKILL.md
  - CHANGELOG.md
  - .agents/skills/spectra-apply/SKILL.md
  - README.md
  - .agents/skills/spectra-discuss/SKILL.md
  - .agents/skills/spectra-audit/SKILL.md
  - .agents/skills/spectra-ingest/SKILL.md
  - .agents/skills/spectra-commit/SKILL.md
  - scripts/windows/start-dashboard.ps1
  - package.json
  - src/collectors/tokscale.js
tests:
  - test/tokscale-command.test.js
-->

---
### Requirement: Private LAN firewall boundary

The setup script SHALL create an enabled inbound Allow rule named `AI Status Dashboard` restricted to the Private profile, TCP local port 8787, and the currently resolved `node.exe`. The setup process MUST NOT add a Public-profile allow rule or change the active network category.

#### Scenario: Current network is Private

- **WHEN** every connected network profile is categorized as Private
- **THEN** setup SHALL replace any same-named rule with exactly one enabled Private inbound TCP 8787 allow rule restricted to the resolved Node.js executable

#### Scenario: Current network is not Private

- **WHEN** any connected network profile is Public or DomainAuthenticated instead of Private
- **THEN** setup SHALL stop before changing Firewall state, report the incompatible profile, and SHALL NOT create or widen a Public-profile rule

#### Scenario: Setup rerun does not duplicate resources

- **WHEN** setup is run twice successfully
- **THEN** exactly one scheduled task and one same-named Firewall rule SHALL exist for the dashboard


<!-- @trace
source: windows-lan-iphone-support
updated: 2026-07-26
code:
  - .agents/skills/spectra-drift/SKILL.md
  - scripts/windows/setup.ps1
  - .agents/skills/spectra-propose/SKILL.md
  - .agents/skills/spectra-archive/SKILL.md
  - .agents/skills/spectra-ask/SKILL.md
  - .agents/skills/spectra-debug/SKILL.md
  - CHANGELOG.md
  - .agents/skills/spectra-apply/SKILL.md
  - README.md
  - .agents/skills/spectra-discuss/SKILL.md
  - .agents/skills/spectra-audit/SKILL.md
  - .agents/skills/spectra-ingest/SKILL.md
  - .agents/skills/spectra-commit/SKILL.md
  - scripts/windows/start-dashboard.ps1
  - package.json
  - src/collectors/tokscale.js
tests:
  - test/tokscale-command.test.js
-->

---
### Requirement: Windows service and LAN verification

After setup starts the scheduled task, the system SHALL verify that Node.js is listening on TCP 8787, `http://localhost:8787/api/status` returns HTTP 200 with both `providers.claude` and `providers.codex`, and the same endpoint succeeds through a displayed non-loopback, non-APIPA Private IPv4 address.

#### Scenario: Local and LAN health checks succeed

- **WHEN** the scheduled task starts the dashboard successfully on a Private network
- **THEN** setup SHALL display `http://<Private-IPv4>:8787`, confirm a Node.js listener on TCP 8787, and confirm both localhost and LAN `/api/status` responses contain `providers.claude` and `providers.codex`

#### Scenario: No eligible LAN address exists

- **WHEN** no connected Private adapter has a non-loopback IPv4 address outside `169.254.0.0/16`
- **THEN** setup SHALL report that no iPhone LAN URL is available and SHALL NOT invent or display a loopback or APIPA URL

#### Scenario: iPhone verification remains manual

- **WHEN** automated Windows and LAN API checks are complete
- **THEN** the final iPhone Safari check SHALL remain pending until Barry opens the displayed URL from an iPhone on the same Wi-Fi and confirms the Claude and Codex cards update


<!-- @trace
source: windows-lan-iphone-support
updated: 2026-07-26
code:
  - .agents/skills/spectra-drift/SKILL.md
  - scripts/windows/setup.ps1
  - .agents/skills/spectra-propose/SKILL.md
  - .agents/skills/spectra-archive/SKILL.md
  - .agents/skills/spectra-ask/SKILL.md
  - .agents/skills/spectra-debug/SKILL.md
  - CHANGELOG.md
  - .agents/skills/spectra-apply/SKILL.md
  - README.md
  - .agents/skills/spectra-discuss/SKILL.md
  - .agents/skills/spectra-audit/SKILL.md
  - .agents/skills/spectra-ingest/SKILL.md
  - .agents/skills/spectra-commit/SKILL.md
  - scripts/windows/start-dashboard.ps1
  - package.json
  - src/collectors/tokscale.js
tests:
  - test/tokscale-command.test.js
-->

---
### Requirement: Existing dashboard interfaces remain unchanged

The Windows LAN runtime SHALL use the existing dashboard server and collector interfaces without changing the `/api/status` schema, frontend assets, provider display logic, macOS launchd behavior, or any multi-device aggregation behavior.

#### Scenario: Windows support introduces no API or UI fields

- **WHEN** a client requests `/api/status` after this change
- **THEN** the response shape and frontend rendering SHALL be identical to the existing single-device dashboard contract and SHALL NOT include operating-system or device aggregation fields

#### Scenario: macOS runtime is unaffected

- **WHEN** the dashboard runs through the existing macOS launchd configuration
- **THEN** its executable invocation, startup, and LAN behavior SHALL remain unchanged

<!-- @trace
source: windows-lan-iphone-support
updated: 2026-07-26
code:
  - .agents/skills/spectra-drift/SKILL.md
  - scripts/windows/setup.ps1
  - .agents/skills/spectra-propose/SKILL.md
  - .agents/skills/spectra-archive/SKILL.md
  - .agents/skills/spectra-ask/SKILL.md
  - .agents/skills/spectra-debug/SKILL.md
  - CHANGELOG.md
  - .agents/skills/spectra-apply/SKILL.md
  - README.md
  - .agents/skills/spectra-discuss/SKILL.md
  - .agents/skills/spectra-audit/SKILL.md
  - .agents/skills/spectra-ingest/SKILL.md
  - .agents/skills/spectra-commit/SKILL.md
  - scripts/windows/start-dashboard.ps1
  - package.json
  - src/collectors/tokscale.js
tests:
  - test/tokscale-command.test.js
-->