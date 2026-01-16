# GitHub Integration Security

## ADDED Requirements

### Requirement: Webhook Signature Verification
All GitHub webhook requests SHALL be cryptographically verified.

#### Scenario: Valid signature accepted
- **WHEN** a GitHub webhook request arrives with valid `X-Hub-Signature-256` header
- **THEN** the signature SHALL be verified against `GITHUB_WEBHOOK_SECRET`
- **AND** the request SHALL be processed

#### Scenario: Invalid signature rejected
- **WHEN** a GitHub webhook request arrives with invalid signature
- **THEN** the request SHALL be rejected with 401 Unauthorized
- **AND** no webhook processing SHALL occur
- **AND** no data SHALL be created or modified

#### Scenario: Missing signature rejected
- **WHEN** a GitHub webhook request arrives without `X-Hub-Signature-256` header
- **THEN** the request SHALL be rejected with 401 Unauthorized
- **AND** no webhook processing SHALL occur

#### Scenario: Timing-safe signature comparison
- **WHEN** a webhook signature is verified
- **THEN** `crypto.subtle.timingSafeEqual` SHALL be used for comparison
- **AND** timing attacks SHALL NOT be possible
- **AND** comparison time SHALL NOT vary based on input

### Requirement: Webhook Event Validation
GitHub webhook events SHALL be validated before processing.

#### Scenario: Event type validated
- **WHEN** a GitHub webhook event is received
- **THEN** the `X-GitHub-Event` header SHALL be checked
- **AND** only expected event types SHALL be processed (`pull_request`, `push`)
- **AND** unexpected event types SHALL be ignored safely

#### Scenario: Repository validation
- **WHEN** a GitHub webhook event is processed
- **THEN** the repository SHALL be checked against watched repos
- **AND** events from unwatched repos SHALL be ignored
- **AND** no data SHALL be created for unwatched repos

#### Scenario: Payload structure validated
- **WHEN** a GitHub webhook payload is parsed
- **THEN** required fields SHALL be validated
- **AND** malformed payloads SHALL be rejected gracefully
- **AND** missing fields SHALL NOT cause unhandled errors

### Requirement: GitHub API Token Security
The GitHub API token SHALL be used securely.

#### Scenario: Token not exposed in responses
- **WHEN** GitHub API calls are made
- **THEN** the `GITHUB_TOKEN` SHALL NOT appear in any user-facing response
- **AND** the token SHALL NOT be logged
- **AND** API errors SHALL NOT reveal the token

#### Scenario: Token has minimal permissions
- **WHEN** the GitHub token is configured
- **THEN** it SHOULD have only required scopes (`repo`, `admin:repo_hook`)
- **AND** excessive permissions SHOULD be avoided

#### Scenario: Token used over HTTPS only
- **WHEN** GitHub API calls are made
- **THEN** all requests SHALL use HTTPS
- **AND** the token SHALL NOT be sent over unencrypted connections

### Requirement: GitHub API Error Handling
GitHub API errors SHALL be handled securely.

#### Scenario: API rate limit handled
- **WHEN** GitHub API returns 403 rate limit exceeded
- **THEN** the error SHALL be handled gracefully
- **AND** the user SHALL be notified appropriately
- **AND** no sensitive information SHALL be revealed

#### Scenario: API authentication errors handled
- **WHEN** GitHub API returns 401 Unauthorized
- **THEN** the error SHALL NOT reveal the token
- **AND** a generic error message SHALL be returned
- **AND** the issue SHALL be logged for debugging

#### Scenario: API not found errors handled
- **WHEN** GitHub API returns 404 Not Found
- **THEN** the user SHALL receive a helpful message
- **AND** internal API paths SHALL NOT be revealed

### Requirement: Webhook URL Security
GitHub webhook configuration SHALL be secure.

#### Scenario: Webhook URL uses HTTPS
- **WHEN** a webhook is created on GitHub
- **THEN** the callback URL SHALL use HTTPS
- **AND** HTTP URLs SHALL NOT be used

#### Scenario: Webhook secret is strong
- **WHEN** a webhook is configured
- **THEN** `GITHUB_WEBHOOK_SECRET` SHALL be cryptographically random
- **AND** the secret SHALL be at least 32 characters
- **AND** the secret SHALL NOT be a common or guessable value

#### Scenario: Webhook URL not hardcoded
- **WHEN** webhook URLs are configured
- **THEN** the worker URL SHOULD be derived from environment or request
- **AND** hardcoded URLs SHOULD be avoided for flexibility

### Requirement: Repository Data Handling
Repository data from GitHub SHALL be handled securely.

#### Scenario: Sensitive repo data protected
- **WHEN** repository information is processed
- **THEN** private repo content SHALL be treated as confidential
- **AND** repo data SHALL only be visible to authorized users
- **AND** repo data SHALL be associated with correct `chat_id`

#### Scenario: Commit data sanitized
- **WHEN** commit messages and diffs are processed
- **THEN** the data SHALL be sanitized before storage
- **AND** excessively large diffs SHALL be truncated
- **AND** binary content SHALL be handled appropriately

#### Scenario: User attribution preserved
- **WHEN** PR or commit data is processed
- **THEN** author information SHALL be preserved accurately
- **AND** author data SHALL NOT be modified or spoofed

### Requirement: Webhook Replay Prevention
GitHub webhooks SHALL be protected against replay attacks.

#### Scenario: Duplicate events handled
- **WHEN** the same webhook event is received multiple times
- **THEN** duplicate processing SHOULD be prevented or handled idempotently
- **AND** multiple drafts SHALL NOT be created for the same event

#### Scenario: Old events handled
- **WHEN** a webhook event with old timestamp is received
- **THEN** the event SHOULD still be processed (GitHub retries)
- **AND** security decisions SHALL NOT rely solely on timestamps
