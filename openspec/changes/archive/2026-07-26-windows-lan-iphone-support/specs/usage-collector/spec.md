## MODIFIED Requirements

### Requirement: tokscale CLI collection resilience

The system SHALL keep the server process alive and the `/api/status` response non-erroring under all tokscale CLI failure modes, degrading to explicit empty or "no data" states rather than crashing or emitting wrong values. All tokscale invocations SHALL pass through a single access wrapper that uses `execFile` with a timeout, bounded output buffer, and hidden Windows child-process windows. On macOS, Linux, and Windows `.exe` binaries, the wrapper SHALL execute the configured binary directly with the original argument array. On Windows, configured `.cmd` or `.bat` binaries SHALL execute through `ComSpec` with each binary and argument token safely quoted so token boundaries are preserved. Report-style commands SHALL pass `--no-spinner`.

#### Scenario: tokscale not installed

- **WHEN** invoking tokscale fails with `ENOENT`
- **THEN** the system SHALL mark the snapshot with an `error`, leave `windows` and `cost` empty, reuse the last persisted `data/snapshot.json` if present, and expose a state the UI can render as an installation banner — without terminating the process

#### Scenario: Codex authorization failure isolated

- **WHEN** `tokscale codex status --json` returns an object containing `error` or fails with HTTP 401
- **THEN** the `codex` provider SHALL have an empty `windows` array and a recorded `error`, and the `claude` provider data SHALL remain unaffected

#### Scenario: Parse failure or schema drift degrades gracefully

- **WHEN** tokscale stdout fails to parse as JSON, or an expected field or metric label is missing
- **THEN** the system SHALL use defensive field access so that an unmappable metric renders as "no data" for that window, and a total collection failure SHALL reuse the last snapshot marked `stale: true`

#### Scenario: Missing cost yields null

- **WHEN** a `tokscale graph` invocation returns no `summary.totalCost` for the requested client
- **THEN** the corresponding `cost.todayUSD` or `cost.last30DaysUSD` SHALL be `null`

#### Scenario: Direct executable invocation remains unchanged

- **WHEN** the configured tokscale binary is used on macOS or Linux, or its Windows path ends in `.exe`
- **THEN** the wrapper SHALL invoke that binary directly and SHALL pass every argument as the same separate array element it received

#### Scenario: Windows npm command shim invocation

- **WHEN** the platform is `win32` and the configured tokscale binary path ends in `.cmd` or `.bat`, including a path containing spaces
- **THEN** the wrapper SHALL invoke `ComSpec` with a safely quoted command string in which the binary and every argument retain their original token boundaries

#### Scenario: Windows command window remains hidden

- **WHEN** any tokscale subprocess is started on Windows
- **THEN** the wrapper SHALL request a hidden child-process window without enabling a global shell mode

#### Scenario: Existing failure semantics are preserved

- **WHEN** a tokscale invocation exits non-zero, times out, or produces invalid JSON
- **THEN** the wrapper SHALL return the existing named tokscale execution or parse error and SHALL NOT classify the failure as a missing installation unless the underlying error code is `ENOENT`
