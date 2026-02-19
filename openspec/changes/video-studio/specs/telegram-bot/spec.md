## ADDED Requirements

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
