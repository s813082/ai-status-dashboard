## ADDED Requirements

### Requirement: Per-device usage snapshot upload contract

Each device SHALL periodically produce a normalized usage snapshot and upload it to the shared private data repository. The uploaded file SHALL be named `devices/<deviceId>.json` and SHALL be overwritten in place on each upload to bound commit history growth. The file SHALL contain `deviceId`, `os`, `generatedAt` as a UTC ISO timestamp, `tokscaleVersion`, and a `providers` object matching the normalized snapshot shape consumed by aggregation.

#### Scenario: Device produces a valid snapshot file

- **WHEN** a device runs its upload routine
- **THEN** it SHALL write `devices/<deviceId>.json` containing `deviceId`, `os`, UTC `generatedAt`, `tokscaleVersion`, and `providers`

#### Scenario: Upload overwrites the same file

- **WHEN** a device uploads again
- **THEN** it SHALL overwrite its existing `devices/<deviceId>.json` rather than creating a new file

### Requirement: Upload credential isolation

The upload routine SHALL authenticate to the data repository using a credential stored outside version control. The credential MUST NOT be embedded in source code, logs, or the uploaded JSON content.

#### Scenario: Credential is not committed

- **WHEN** the upload routine authenticates
- **THEN** the credential SHALL be read from a local credential store and MUST NOT appear in any committed file or log

### Requirement: Scheduled execution per platform

The upload routine SHALL run on a recurring schedule on each supported platform. On macOS it SHALL be registered via launchd; on Windows it SHALL be registered via Task Scheduler.

#### Scenario: Recurring upload on macOS

- **WHEN** the device is macOS
- **THEN** the upload routine SHALL be registered as a recurring launchd job

#### Scenario: Recurring upload on Windows

- **WHEN** the device is Windows
- **THEN** the upload routine SHALL be registered as a recurring Task Scheduler task
