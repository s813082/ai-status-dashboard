## ADDED Requirements

### Requirement: Containerized deployment to Zeabur

The system SHALL be deployable to Zeabur as a container. The container SHALL bind to the port provided by the `PORT` environment variable and to host `0.0.0.0`. All runtime configuration SHALL be provided through environment variables (`DATA_SOURCE`, `GITHUB_TOKEN`, `GITHUB_DATA_REPO`, `GITHUB_DATA_BRANCH`, `REFRESH_MS`, `DASHBOARD_TOKEN`) and MUST NOT be hardcoded.

#### Scenario: Container honors platform port

- **WHEN** the platform sets the `PORT` environment variable
- **THEN** the server SHALL listen on that port bound to `0.0.0.0`

#### Scenario: Configuration comes from environment

- **WHEN** the container starts
- **THEN** all data-source and credential configuration SHALL be read from environment variables and MUST NOT be read from committed source files

### Requirement: Access control for the public dashboard

The system SHALL protect the dashboard behind token-based access control when exposed on a public URL, using the `DASHBOARD_TOKEN` environment variable. Requests without a valid token SHALL be rejected with a non-200 status and MUST NOT expose usage or cost data.

#### Scenario: Missing credential is rejected

- **WHEN** a request arrives without a valid `DASHBOARD_TOKEN`
- **THEN** the server SHALL respond with HTTP 401 and SHALL NOT return usage data

#### Scenario: Valid credential is accepted

- **WHEN** a request arrives with the correct token
- **THEN** the server SHALL respond with HTTP 200 and serve the dashboard

### Requirement: No credentials in source or logs

The system SHALL NOT write any token, PAT, or secret into source code, logs, or committed files.

#### Scenario: Repository contains no plaintext secrets

- **WHEN** the repository and diff are scanned for secrets
- **THEN** no token, PAT, or key SHALL appear in plaintext
