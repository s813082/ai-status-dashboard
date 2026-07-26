## ADDED Requirements

### Requirement: Per-device usage snapshot upload contract

Each device SHALL periodically produce a normalized usage snapshot and upload it to the shared private data repository. The upload SHALL use a single authenticated GitHub contents API request (HTTP PUT) and MUST NOT require a local git clone, commit, or push. The uploaded file SHALL be named `devices/<deviceId>.json` and SHALL be overwritten in place on each upload to bound commit history growth. The file SHALL contain `deviceId`, `os`, `generatedAt` as a UTC ISO timestamp, `tokscaleVersion`, and a `providers` object matching the normalized snapshot shape consumed by aggregation.

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

### Requirement: Scheduled execution per host type

The upload routine SHALL be a single shared implementation that runs on a recurring schedule on every supported host type. On macOS it SHALL be registered via launchd; on Windows it SHALL be registered via Task Scheduler; inside a Linux container it SHALL be registered via a container-local scheduler such as cron. Host-specific configuration SHALL be limited to the schedule registration and the `deviceId`, so that upload behavior cannot drift between hosts.

#### Scenario: Recurring upload on macOS

- **WHEN** the device is macOS
- **THEN** the upload routine SHALL be registered as a recurring launchd job

#### Scenario: Recurring upload on Windows

- **WHEN** the device is Windows
- **THEN** the upload routine SHALL be registered as a recurring Task Scheduler task

#### Scenario: Recurring upload inside a container

- **WHEN** the host is a Linux container such as the hermes-agent service
- **THEN** the upload routine SHALL be registered with a container-local scheduler, and the registration SHALL survive container restart by residing on a persistent volume or being re-applied on start

#### Scenario: Shared implementation across hosts

- **WHEN** the upload routine runs on any supported host
- **THEN** it SHALL execute the same script, differing only in schedule registration and `deviceId`

### Requirement: Hosts without local session logs still report

A host MAY have account-level quota available while producing no local session log data. Such a host SHALL still upload a valid snapshot, reporting its quota windows and a zero or absent cost, and MUST NOT be treated as an error by aggregation.

#### Scenario: Host reports quota but no cost

- **WHEN** a host can query account quota but has no local session logs to derive cost from
- **THEN** it SHALL upload a snapshot containing quota windows with cost values of zero or null, and aggregation SHALL include its quota while contributing nothing to the cost total
