# Cloudflare Worker Security

### Requirement: Worker Entry Point Security
All HTTP endpoints exposed by the Cloudflare Worker SHALL implement appropriate security controls.

#### Scenario: Health endpoint is public
- **WHEN** a request is made to `/health`
- **THEN** the endpoint SHALL return 200 OK
- **AND** no sensitive information SHALL be revealed
- **AND** no authentication SHALL be required

#### Scenario: Unknown routes return 404
- **WHEN** a request is made to an undefined route
- **THEN** the worker SHALL return 404 Not Found
- **AND** no information about valid routes SHALL be revealed

#### Scenario: All responses include security headers
- **WHEN** any HTTP response is returned from the worker
- **THEN** `X-Content-Type-Options: nosniff` header SHALL be included
- **AND** `X-Frame-Options: DENY` header SHALL be included
- **AND** `X-XSS-Protection: 1; mode=block` header SHALL be included

### Requirement: Environment Secret Management
All shared infrastructure keys/tokens SHALL be stored as Cloudflare secrets: `TELEGRAM_BOT_TOKEN`, `ENCRYPTION_KEY`, `ADMIN_SECRET`, `GITHUB_WEBHOOK_SECRET`, `TELEGRAM_CHAT_ID`. Per-user API keys (`GOOGLE_API_KEY`, `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`, `GITHUB_TOKEN`, `HEYGEN_API_KEY`) SHALL be stored encrypted in D1 `users` table and resolved per-request via env hydration. The `Env` interface SHALL include `ENCRYPTION_KEY: string` and `MAX_USERS?: string`.

#### Scenario: Per-user keys not in Worker secrets
- **WHEN** the Worker is deployed
- **THEN** per-user API keys are NOT stored as Worker secrets — they exist only in D1 encrypted

#### Scenario: ENCRYPTION_KEY in Worker secrets
- **WHEN** the Worker starts
- **THEN** `env.ENCRYPTION_KEY` is available as a Worker secret for encrypting/decrypting user keys

### Requirement: Request Validation
All incoming requests SHALL be validated before processing.

#### Scenario: JSON parsing errors handled
- **WHEN** a request with invalid JSON body is received
- **THEN** the worker SHALL return a 400 Bad Request
- **AND** the error message SHALL NOT reveal internal structure

#### Scenario: Large request bodies rejected
- **WHEN** a request body exceeds reasonable size limits
- **THEN** the worker SHALL reject the request
- **AND** resource exhaustion attacks SHALL be mitigated

#### Scenario: Unexpected content types handled
- **WHEN** a request with unexpected Content-Type is received
- **THEN** the worker SHALL handle it gracefully
- **AND** no security vulnerabilities SHALL be introduced

### Requirement: D1 Database Security
Database operations SHALL be performed securely.

#### Scenario: SQL injection prevented
- **WHEN** user input is used in database queries
- **THEN** parameterized queries SHALL be used
- **AND** user input SHALL NOT be concatenated into SQL strings

#### Scenario: Database errors sanitized
- **WHEN** a database error occurs
- **THEN** the error message returned to users SHALL be generic
- **AND** table names and schema details SHALL NOT be revealed
- **AND** full SQL queries SHALL NOT be logged

### Requirement: R2 Storage Security
R2 bucket operations SHALL be performed securely.

#### Scenario: R2 keys validated
- **WHEN** an R2 object key is constructed from user input
- **THEN** path traversal characters SHALL be rejected (`..`, `//`)
- **AND** absolute paths SHALL be rejected
- **AND** only alphanumeric, dash, underscore, and forward slash SHALL be allowed

#### Scenario: R2 object metadata protected
- **WHEN** R2 objects are accessed
- **THEN** sensitive metadata SHALL NOT be exposed to users
- **AND** internal storage paths SHALL NOT be revealed

#### Scenario: R2 uploads validated
- **WHEN** content is uploaded to R2
- **THEN** content type SHALL be validated
- **AND** file size limits SHALL be enforced
- **AND** only expected file types SHALL be accepted (images)

### Requirement: Cron Trigger Security
Scheduled tasks SHALL execute securely.

#### Scenario: Cron jobs use stored credentials
- **WHEN** a cron job executes
- **THEN** it SHALL use the configured `TELEGRAM_CHAT_ID` for ownership
- **AND** it SHALL NOT create data without proper ownership attribution

#### Scenario: Cron job errors contained
- **WHEN** a cron job encounters an error
- **THEN** the error SHALL NOT affect other scheduled tasks
- **AND** sensitive information SHALL NOT be sent in notifications

### Requirement: Response Security
All HTTP responses SHALL follow security best practices.

#### Scenario: No sensitive headers exposed
- **WHEN** any HTTP response is returned
- **THEN** `Server` header SHALL NOT reveal implementation details
- **AND** internal version information SHALL NOT be exposed

#### Scenario: Error responses are safe
- **WHEN** an error response is returned
- **THEN** stack traces SHALL NOT be included
- **AND** file paths SHALL NOT be revealed
- **AND** environment variable names SHALL NOT be revealed

#### Scenario: Cache headers appropriate
- **WHEN** cacheable content is returned
- **THEN** `Cache-Control` SHALL have appropriate directives
- **AND** private data SHALL use `private` directive
- **AND** authentication-required resources SHALL use `no-store`

### Requirement: users table replaces chat_state
The D1 database SHALL have a `users` table that combines user identity, encrypted keys, UI state, and settings. The `chat_state` table SHALL be dropped after data migration.

#### Scenario: users table exists after migration
- **WHEN** the migration runs
- **THEN** the `users` table exists with columns for identity, encrypted keys, feature flags, UI state, settings, rate limiting, and timestamps

#### Scenario: chat_state data preserved
- **WHEN** the migration runs and an existing `chat_state` row exists
- **THEN** the UI state and settings data (message_id, current_view, context, timezone, page_size, video_settings) is copied to the corresponding `users` row
