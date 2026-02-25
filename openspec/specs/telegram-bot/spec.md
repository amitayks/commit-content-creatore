# Telegram Bot Authorization

### Requirement: Single-User Authorization
The webhook entry point SHALL authorize users by looking up their `chat_id` in the `users` table. Users with `status = 'active'` are authorized for all features. Users with `status = 'onboarding'` are redirected to the onboarding flow. Users with `status = 'suspended'` receive a suspension message. Unregistered users (no `users` row) enter the onboarding flow. The `isAdmin(chatId, env)` function (`String(chatId) === env.TELEGRAM_CHAT_ID`) is used only for admin-specific features (Video Studio, admin endpoints), not for general authorization.

#### Scenario: Active registered user sends a message
- **WHEN** a user with `status = 'active'` in the `users` table sends a message
- **THEN** the message is authorized and routed to handlers normally

#### Scenario: Unregistered user sends a message
- **WHEN** a user with no row in the `users` table sends any message
- **THEN** a `users` row is created with `status = 'onboarding'` and the onboarding flow begins

#### Scenario: Onboarding user sends a message
- **WHEN** a user with `status = 'onboarding'` sends a message
- **THEN** the message is routed to the onboarding handler at the user's current step

#### Scenario: Suspended user sends a message
- **WHEN** a user with `status = 'suspended'` sends a message
- **THEN** the bot responds with a suspension notice and does not process the message

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
All database tables (`drafts`, `repos`, `published`, `video_drafts`, `video_published`, `video_presets`, `twitter_accounts`, `twitter_tweets`, `users`) carry a `chat_id` column. All read and write operations SHALL filter by `chat_id` to ensure data isolation between users.

#### Scenario: User queries their drafts
- **WHEN** a user requests their drafts list
- **THEN** only drafts with matching `chat_id` are returned

#### Scenario: User cannot access another user's data
- **WHEN** a user's request is processed
- **THEN** all DB queries include `WHERE chat_id = ?` with the requesting user's chat_id

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

### Requirement: Video Studio callback routes
The Telegram bot callback handler SHALL recognize and route video studio callback data patterns: `view:video_studio`, `view:video_repo:{repoId}`, `view:video_list:{repoId}:{status}`, `view:video_detail:{videoDraftId}`, `action:video_create:{repoId}`, `action:video_config:{field}:{value}`, `action:video_approve_script:{videoDraftId}`, `action:video_regen_script`, `action:video_publish:{videoDraftId}`, `action:video_schedule:{videoDraftId}`, `action:video_delete:{videoDraftId}`, `action:video_engine:{engine}`, `action:video_emotion:{emotion}`, `action:video_captions:{on|off}`, `action:video_overlay:{on|off}`, `action:video_bg:{type}`.

#### Scenario: Navigate to Video Studio
- **WHEN** a callback with data `view:video_studio` is received
- **THEN** the handler SHALL render the Video Studio home view

#### Scenario: Navigate to repo video list
- **WHEN** a callback with data `view:video_repo:{repoId}` is received
- **THEN** the handler SHALL render the repo's video category view

#### Scenario: Navigate to video detail
- **WHEN** a callback with data `view:video_detail:{videoDraftId}` is received
- **THEN** the handler SHALL render the video detail view for the specified draft

#### Scenario: Video action callbacks
- **WHEN** a callback with data matching `action:video_*` is received
- **THEN** the handler SHALL execute the corresponding video action (publish, schedule, delete, approve, regenerate, engine toggle, emotion select, etc.)

### Requirement: Video compose mode state
The chat_state context SHALL support a `videoCompose` state for manual instructions input, tracking: whether video compose is active, the target repo ID, the buffered instructions, and the current video configuration being built.

#### Scenario: Enter video compose mode
- **WHEN** user clicks "Manual Instructions" in video config
- **THEN** `chat_state.context.videoCompose` SHALL be set to `{ active: true, repoId, instructions: [], config: {...} }`

#### Scenario: Exit video compose mode
- **WHEN** user clicks "Save" or "Cancel" in video compose mode
- **THEN** `chat_state.context.videoCompose.active` SHALL be set to false

#### Scenario: Message routing during video compose
- **WHEN** a text message is received and `videoCompose.active` is true
- **THEN** the message SHALL be routed to the video compose handler (not the regular message handler)

### Requirement: Character creation compose mode
The chat_state context SHALL support a `characterCreate` state for the character creation flow through the bot.

#### Scenario: Enter character creation mode
- **WHEN** user clicks "Add Character" in video settings
- **THEN** `chat_state.context.characterCreate` SHALL be set to `{ active: true, step: 'awaiting_photo' }`

#### Scenario: Character creation photo step
- **WHEN** a photo is received and `characterCreate.active` is true and `step` is 'awaiting_photo'
- **THEN** the photo SHALL be uploaded to HeyGen via the asset upload API
- **AND** `characterCreate.step` SHALL be set to 'awaiting_name'
- **AND** `characterCreate.assetId` SHALL be stored

#### Scenario: Character creation name step
- **WHEN** a text message is received and `characterCreate.active` is true and `step` is 'awaiting_name'
- **THEN** the avatar group SHALL be created on HeyGen with the provided name
- **AND** the default look training SHALL be started
- **AND** `characterCreate.active` SHALL be set to false

#### Scenario: Cancel character creation
- **WHEN** user sends "Cancel" or a slash command during character creation
- **THEN** `characterCreate.active` SHALL be set to false
- **AND** any uploaded assets SHALL be abandoned (not cleaned up on HeyGen)

### Requirement: Look creation compose mode
The chat_state context SHALL support a `lookCreate` state for the look creation flow through the bot.

#### Scenario: Enter look creation mode
- **WHEN** user clicks "Add Look" for a character in video settings
- **THEN** `chat_state.context.lookCreate` SHALL be set to `{ active: true, characterGroupId: string, step: 'awaiting_name' }`

#### Scenario: Look creation name step
- **WHEN** a text message is received and `lookCreate.active` is true and `step` is 'awaiting_name'
- **THEN** the talking photo SHALL be generated on HeyGen with the provided name
- **AND** `lookCreate.active` SHALL be set to false

### Requirement: HeyGen webhook endpoint
The Worker SHALL expose a `/heygen-webhook` HTTP POST endpoint that receives HeyGen callback notifications for video generation events.

#### Scenario: Webhook routing
- **WHEN** a POST request is received at `/heygen-webhook`
- **THEN** the Worker's fetch handler SHALL route it to the HeyGen webhook handler
- **AND** this SHALL be separate from the Telegram webhook route

#### Scenario: Webhook response
- **WHEN** the webhook handler processes a callback
- **THEN** it SHALL return a 200 OK response promptly (within the Worker timeout)
- **AND** perform video download, R2 storage, DB update, and Telegram notification

#### Scenario: Invalid webhook request
- **WHEN** a POST to `/heygen-webhook` contains no recognizable video_id or doesn't match any generating draft
- **THEN** the handler SHALL return 400 Bad Request
- **AND** log the rejected request for debugging

### Requirement: Video cron integration
The existing cron handler SHALL be extended to serve as a fallback safety net for webhook-based video processing.

#### Scenario: Cron checks for stale generating videos (webhook fallback)
- **WHEN** the hourly cron runs and there are video drafts with status "generating" for more than 30 minutes
- **THEN** the handler SHALL call `checkVideoStatus()` via HeyGen API for each
- **AND IF** HeyGen reports completed → download + store + update status + notify user (webhook was missed)
- **AND IF** HeyGen reports still processing → leave as-is if under 30 min, mark failed if over
- **AND IF** HeyGen reports failed → update status to "failed" + notify user

#### Scenario: Cron processes queued videos
- **WHEN** the hourly cron runs and there are no "generating" video drafts but there are "queued" ones
- **THEN** the handler SHALL start the oldest queued draft by sending it to HeyGen
- **AND** update status to "generating"

#### Scenario: Cron publishes scheduled videos
- **WHEN** the hourly cron runs and there are video drafts with status "scheduled" and `scheduled_at <= NOW()`
- **THEN** the handler SHALL publish each due video to the configured platforms
- **AND** update status to "published"
- **AND** notify user via Telegram with publish URLs

### Requirement: Message routing priority
The Telegram message handler SHALL check for active compose modes in priority order before handling as a regular message.

#### Scenario: Compose mode priority
- **WHEN** a message is received
- **THEN** the handler SHALL check in order:
  1. `characterCreate.active` — route to character creation handler
  2. `lookCreate.active` — route to look creation handler
  3. `videoCompose.active` — route to video compose handler
  4. Existing compose modes (handwrite, etc.)
  5. Regular message handling
