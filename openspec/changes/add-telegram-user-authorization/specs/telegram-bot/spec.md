# Telegram Bot Authorization

## ADDED Requirements

### Requirement: Single-User Authorization
The Telegram bot SHALL only accept commands and interactions from the authorized user configured via the `TELEGRAM_CHAT_ID` environment variable. All Telegram update types MUST be protected.

#### Scenario: Authorized user sends text message
- **WHEN** a Telegram user with ID matching `TELEGRAM_CHAT_ID` sends a text message
- **THEN** the message SHALL be processed normally
- **AND** the user SHALL receive the expected response

#### Scenario: Authorized user sends slash command
- **WHEN** a Telegram user with ID matching `TELEGRAM_CHAT_ID` sends a command like `/start`, `/generate`, `/drafts`
- **THEN** the command SHALL be processed normally
- **AND** the user SHALL receive the expected response

#### Scenario: Authorized user clicks inline button
- **WHEN** a Telegram user with ID matching `TELEGRAM_CHAT_ID` clicks an inline button (callback query)
- **THEN** the callback SHALL be processed normally
- **AND** the UI SHALL update accordingly

#### Scenario: Unauthorized user sends text message
- **WHEN** a Telegram user with ID NOT matching `TELEGRAM_CHAT_ID` sends a text message
- **THEN** the request SHALL be rejected before any handler is invoked
- **AND** the user SHALL receive a generic "unauthorized" message
- **AND** no sensitive information SHALL be revealed in the response

#### Scenario: Unauthorized user sends slash command
- **WHEN** a Telegram user with ID NOT matching `TELEGRAM_CHAT_ID` sends any slash command
- **THEN** the request SHALL be rejected before the command handler is invoked
- **AND** the user SHALL receive the same generic "unauthorized" message
- **AND** the response SHALL NOT reveal which commands exist

#### Scenario: Unauthorized user clicks inline button
- **WHEN** a Telegram user with ID NOT matching `TELEGRAM_CHAT_ID` clicks an inline button
- **THEN** the callback SHALL be rejected before any handler is invoked
- **AND** the callback SHALL be answered with an error notification
- **AND** no data SHALL be accessed or modified

### Requirement: User ID Extraction
The system SHALL extract the user ID from the correct field based on update type.

#### Scenario: Extract user ID from message
- **WHEN** a Telegram update contains a `message` field
- **THEN** the user ID SHALL be extracted from `update.message.from.id`
- **AND** this ID SHALL be compared against `TELEGRAM_CHAT_ID`

#### Scenario: Extract user ID from callback query
- **WHEN** a Telegram update contains a `callback_query` field
- **THEN** the user ID SHALL be extracted from `update.callback_query.from.id`
- **AND** this ID SHALL be compared against `TELEGRAM_CHAT_ID`

#### Scenario: Extract user ID from inline query (future-proofing)
- **WHEN** a Telegram update contains an `inline_query` field
- **THEN** the user ID SHALL be extracted from `update.inline_query.from.id`
- **AND** this ID SHALL be compared against `TELEGRAM_CHAT_ID`

### Requirement: Authorization Check Location
The authorization check SHALL occur at the webhook entry point before any handlers are invoked.

#### Scenario: Early rejection prevents data access
- **WHEN** an unauthorized request arrives at the webhook
- **THEN** the authorization check SHALL execute before `handleMessage()` or `handleCallback()`
- **AND** no database queries SHALL be executed for unauthorized requests
- **AND** no chat state SHALL be created or modified for unauthorized users

#### Scenario: Authorization runs before all code paths
- **WHEN** any Telegram update is received
- **THEN** the authorization check SHALL be the first logic executed after JSON parsing
- **AND** no business logic SHALL run for unauthorized users

### Requirement: Database-Level Ownership
All data tables SHALL track ownership via `chat_id` column as a second line of defense.

#### Scenario: Drafts table has owner
- **WHEN** a draft is created
- **THEN** the `chat_id` of the creating user SHALL be stored with the draft
- **AND** the draft SHALL only be retrievable by queries that match this `chat_id`

#### Scenario: Repos table has owner
- **WHEN** a repo is added to watch list
- **THEN** the `chat_id` of the adding user SHALL be stored with the repo
- **AND** the repo SHALL only be retrievable by queries that match this `chat_id`

#### Scenario: Published table has owner
- **WHEN** a published record is created
- **THEN** the `chat_id` of the publishing user SHALL be stored with the record
- **AND** the record SHALL only be retrievable by queries that match this `chat_id`

### Requirement: Database Query Filtering
All database read operations SHALL require and filter by `chat_id`.

#### Scenario: Get all drafts filters by owner
- **WHEN** `getAllDrafts()` is called with a `chat_id`
- **THEN** only drafts belonging to that `chat_id` SHALL be returned
- **AND** drafts belonging to other users SHALL NOT be returned

#### Scenario: Get all repos filters by owner
- **WHEN** `getRepos()` is called with a `chat_id`
- **THEN** only repos belonging to that `chat_id` SHALL be returned
- **AND** repos belonging to other users SHALL NOT be returned

#### Scenario: Get single draft verifies owner
- **WHEN** `getDraft()` is called with a draft ID and `chat_id`
- **THEN** the draft SHALL only be returned if it belongs to that `chat_id`
- **AND** null SHALL be returned if the draft belongs to a different user

#### Scenario: Get single repo verifies owner
- **WHEN** `getRepo()` is called with a repo ID and `chat_id`
- **THEN** the repo SHALL only be returned if it belongs to that `chat_id`
- **AND** null SHALL be returned if the repo belongs to a different user

### Requirement: Database Mutation Authorization
All database write operations SHALL verify ownership before modifying data.

#### Scenario: Update draft verifies owner
- **WHEN** `updateDraft()` is called with a draft ID and `chat_id`
- **THEN** the update SHALL only succeed if the draft belongs to that `chat_id`
- **AND** the update SHALL fail silently if ownership doesn't match

#### Scenario: Delete draft verifies owner
- **WHEN** `deleteDraft()` is called with a draft ID and `chat_id`
- **THEN** the deletion SHALL only succeed if the draft belongs to that `chat_id`
- **AND** drafts belonging to other users SHALL NOT be affected

#### Scenario: Update repo verifies owner
- **WHEN** `updateRepo()` is called with a repo ID and `chat_id`
- **THEN** the update SHALL only succeed if the repo belongs to that `chat_id`
- **AND** the update SHALL fail silently if ownership doesn't match

#### Scenario: Delete repo verifies owner
- **WHEN** `deleteRepo()` is called with a repo ID and `chat_id`
- **THEN** the deletion SHALL only succeed if the repo belongs to that `chat_id`
- **AND** repos belonging to other users SHALL NOT be affected

### Requirement: Database Migration
Existing data SHALL be migrated to include ownership information.

#### Scenario: Migration adds chat_id column
- **WHEN** the database migration runs
- **THEN** `chat_id` column SHALL be added to `drafts`, `repos`, and `published` tables
- **AND** existing records SHALL be assigned the configured `TELEGRAM_CHAT_ID` as owner
- **AND** the column SHALL NOT allow NULL values after migration

### Requirement: Admin Endpoint Protection
Administrative endpoints SHALL require authentication to prevent unauthorized access.

#### Scenario: Setup endpoint requires admin secret
- **WHEN** a request is made to `/setup` without valid `ADMIN_SECRET` header
- **THEN** the request SHALL be rejected with 401 Unauthorized
- **AND** no webhook configuration SHALL be modified

#### Scenario: Setup endpoint accepts valid admin secret
- **WHEN** a request is made to `/setup` with valid `ADMIN_SECRET` header
- **THEN** the webhook setup SHALL proceed normally

#### Scenario: Migrate endpoint requires admin secret
- **WHEN** a request is made to `/migrate` without valid `ADMIN_SECRET` header
- **THEN** the request SHALL be rejected with 401 Unauthorized
- **AND** no database migrations SHALL be executed

#### Scenario: Migrate endpoint accepts valid admin secret
- **WHEN** a request is made to `/migrate` with valid `ADMIN_SECRET` header
- **THEN** the migration SHALL proceed normally

### Requirement: R2 Image Access Control
Draft images SHALL NOT be publicly accessible without authorization.

#### Scenario: Image endpoint requires authentication
- **WHEN** a request is made to `/image/*` without valid authentication
- **THEN** the request SHALL be rejected with 401 Unauthorized
- **AND** no image data SHALL be returned

#### Scenario: Image key validation prevents path traversal
- **WHEN** an image key contains path traversal characters (`..`, `/`)
- **THEN** the request SHALL be rejected
- **AND** no R2 objects outside the intended prefix SHALL be accessible

#### Scenario: Signed URLs for Telegram image display
- **WHEN** an image needs to be displayed in Telegram
- **THEN** a time-limited signed URL SHALL be generated
- **AND** the URL SHALL expire after a reasonable time period

### Requirement: Cryptographic Security
All secret comparisons SHALL use timing-safe algorithms to prevent timing attacks.

#### Scenario: GitHub webhook signature uses constant-time comparison
- **WHEN** a GitHub webhook signature is verified
- **THEN** the comparison SHALL use `crypto.subtle.timingSafeEqual` or equivalent
- **AND** the comparison time SHALL NOT vary based on how many characters match

#### Scenario: Admin secret uses constant-time comparison
- **WHEN** an admin secret is verified
- **THEN** the comparison SHALL use timing-safe comparison
- **AND** timing attacks SHALL NOT be possible

### Requirement: Rate Limiting
All endpoints SHALL implement rate limiting to prevent abuse and DoS attacks.

#### Scenario: Telegram webhook rate limited
- **WHEN** excessive requests arrive at `/webhook`
- **THEN** requests exceeding the rate limit SHALL be rejected with 429 Too Many Requests
- **AND** legitimate traffic SHALL continue to be processed

#### Scenario: Admin endpoints rate limited
- **WHEN** excessive requests arrive at `/setup` or `/migrate`
- **THEN** requests exceeding the rate limit SHALL be rejected
- **AND** rate limits SHALL be stricter than public endpoints

#### Scenario: Image endpoint rate limited
- **WHEN** excessive requests arrive at `/image/*`
- **THEN** requests exceeding the rate limit SHALL be rejected
- **AND** enumeration attacks SHALL be mitigated

### Requirement: Error Handling and Information Disclosure
Error responses SHALL NOT reveal sensitive information about the system.

#### Scenario: Internal errors return generic message
- **WHEN** an internal error occurs during request processing
- **THEN** the user SHALL receive a generic error message like "An error occurred"
- **AND** stack traces SHALL NOT be included in the response
- **AND** internal paths SHALL NOT be revealed

#### Scenario: Database errors are sanitized
- **WHEN** a database error occurs
- **THEN** the error message SHALL NOT reveal table names or query details
- **AND** the user SHALL receive a generic error message

#### Scenario: API errors are sanitized
- **WHEN** an external API (Grok, X, GitHub) returns an error
- **THEN** API keys and tokens SHALL NOT be included in error messages
- **AND** the user SHALL receive a helpful but safe error message

### Requirement: Security Headers
All HTTP responses SHALL include appropriate security headers.

#### Scenario: Responses include security headers
- **WHEN** any HTTP response is returned
- **THEN** `X-Content-Type-Options: nosniff` SHALL be included
- **AND** `X-Frame-Options: DENY` SHALL be included
- **AND** appropriate `Cache-Control` headers SHALL be set

#### Scenario: Draft images have limited cache
- **WHEN** a draft image is served
- **THEN** `Cache-Control` SHALL have a reasonable max-age (not 1 year)
- **AND** `private` directive SHALL be used to prevent CDN caching of drafts

### Requirement: Secure Logging
Application logs SHALL NOT contain sensitive information.

#### Scenario: Secrets not logged
- **WHEN** any logging occurs
- **THEN** API keys, tokens, and secrets SHALL NOT be logged
- **AND** user IDs and chat IDs SHALL be logged minimally

#### Scenario: Error details logged safely
- **WHEN** errors are logged for debugging
- **THEN** full stack traces MAY be logged server-side
- **AND** request bodies containing sensitive data SHALL be redacted
