## ADDED Requirements

### Requirement: HeyGen API client module
The system SHALL provide a `services/heygen.ts` module with functions for all HeyGen API interactions: video generation, job status, video download, asset upload, photo avatar creation, and webhook handling.

#### Scenario: API authentication
- **WHEN** any HeyGen API call is made
- **THEN** the `HEYGEN_API_KEY` environment variable SHALL be included as `x-api-key` header
- **AND** the key SHALL NOT be logged or exposed in error messages
- **AND** requests SHALL use base URL `https://api.heygen.com`

### Requirement: Multi-scene video generation
The system SHALL call `POST /v2/video/generate` with a multi-scene payload to create avatar videos.

#### Scenario: Create single-scene video
- **WHEN** `createVideo(env, config)` is called with a single scene
- **THEN** the request body SHALL include:
  - `video_inputs[0].character.type` = "talking_photo"
  - `video_inputs[0].character.talking_photo_id` = the character's photo ID
  - `video_inputs[0].voice.type` = "text"
  - `video_inputs[0].voice.input_text` = the scene's script text
  - `video_inputs[0].voice.voice_id` = the configured voice ID
  - `video_inputs[0].voice.speed` = 1.0 (default)
  - `video_inputs[0].voice.emotion` = the scene's emotion setting (Excited/Friendly/Serious/Soothing/Broadcaster)
  - `dimension.width` and `dimension.height` based on aspect ratio selection
  - `callback_url` = the Worker's `/heygen-webhook` endpoint URL
- **AND** return the `video_id` from the response

#### Scenario: Create multi-scene video
- **WHEN** `createVideo(env, config)` is called with multiple scenes
- **THEN** each scene SHALL be a separate entry in the `video_inputs` array
- **AND** each scene MAY have different `voice.emotion` and `avatar_style` values
- **AND** HeyGen supports up to 50 scenes per video

#### Scenario: Avatar style options
- **WHEN** creating a video with Avatar IV engine
- **THEN** `character.avatar_style` MAY be set to "normal" (default), "closeUp", or "circle"
- **WHEN** creating a video with Avatar III engine
- **THEN** `character.avatar_style` SHALL be "normal" only

#### Scenario: Background configuration
- **WHEN** a background color is configured
- **THEN** `video_inputs[].background.type` SHALL be "color" and `video_inputs[].background.value` SHALL be the hex color (e.g., "#FFFFFF")
- **WHEN** a background image URL is configured
- **THEN** `video_inputs[].background.type` SHALL be "image" and `video_inputs[].background.value` SHALL be the image URL

#### Scenario: Text overlay per scene
- **WHEN** a scene has text overlay content
- **THEN** `video_inputs[].text_overlay.text` SHALL contain the overlay text
- **AND** `video_inputs[].text_overlay.style` MAY configure font, color, and position

#### Scenario: Built-in captions
- **WHEN** the user enables captions in video config
- **THEN** the request body SHALL include `caption: true` at the top level
- **AND** HeyGen SHALL burn captions directly into the video

#### Scenario: Dimension mapping from aspect ratio
- **WHEN** aspect ratio is "9:16 Reel" → dimension SHALL be `{ width: 1080, height: 1920 }`
- **WHEN** aspect ratio is "16:9 Landscape" → dimension SHALL be `{ width: 1920, height: 1080 }`
- **WHEN** aspect ratio is "1:1 Square" → dimension SHALL be `{ width: 1080, height: 1080 }`

### Requirement: Video status checking
The system SHALL provide a `checkVideoStatus(env, videoId)` function that queries HeyGen for video generation status.

#### Scenario: Check status via API
- **WHEN** `checkVideoStatus()` is called
- **THEN** it SHALL call `GET /v1/video_status.get?video_id={videoId}`
- **AND** return a typed status object

#### Scenario: Video still processing
- **WHEN** the API returns status "processing" or "pending"
- **THEN** it SHALL return `{ status: 'generating' }`

#### Scenario: Video completed
- **WHEN** the API returns status "completed"
- **THEN** it SHALL return `{ status: 'completed', videoUrl: string, duration: number }`
- **AND** the `videoUrl` is the HeyGen download URL (expires in 7 days)

#### Scenario: Video failed
- **WHEN** the API returns status "failed"
- **THEN** it SHALL return `{ status: 'failed', error: string }`

### Requirement: Webhook callback handler
The system SHALL expose a `/heygen-webhook` endpoint that receives HeyGen callback notifications when video generation completes or fails.

#### Scenario: Webhook receives success callback
- **WHEN** HeyGen sends a POST to `/heygen-webhook` with `event_type: "avatar_video.success"`
- **THEN** the handler SHALL extract the `video_id` from the payload
- **AND** download the video from the provided URL
- **AND** store it in R2 at `videos/{videoDraftId}/video.mp4`
- **AND** update the video draft status to "completed"
- **AND** update `video_url` with the R2 key
- **AND** notify the user via Telegram with a video preview and action buttons
- **AND** advance the queue (start next queued job if any)

#### Scenario: Webhook receives failure callback
- **WHEN** HeyGen sends a POST to `/heygen-webhook` with `event_type: "avatar_video.fail"`
- **THEN** the handler SHALL extract the `video_id` and error details
- **AND** update the video draft status to "failed"
- **AND** notify the user via Telegram with the failure reason
- **AND** advance the queue

#### Scenario: Webhook security
- **WHEN** a POST is received at `/heygen-webhook`
- **THEN** the handler SHALL validate the request originates from HeyGen (verify callback contains a valid video_id that matches a "generating" draft)
- **AND** reject requests that don't match any known generating draft

### Requirement: Video download with expiry awareness
The system SHALL provide a `downloadVideo(env, videoUrl)` function that downloads completed videos from HeyGen immediately (before the 7-day URL expiry).

#### Scenario: Successful download
- **WHEN** `downloadVideo()` is called with a valid HeyGen video URL
- **THEN** it SHALL download the full video file
- **AND** return `{ data: ArrayBuffer, mimeType: string, size: number }`

#### Scenario: File size validation
- **WHEN** the downloaded video exceeds 200MB
- **THEN** the function SHALL reject the video and return a size error

#### Scenario: Download timeout
- **WHEN** the video download takes longer than 120 seconds
- **THEN** the function SHALL timeout and return an error

### Requirement: Photo Avatar creation flow
The system SHALL provide functions for creating HeyGen Photo Avatars through the bot, enabling character setup without leaving Telegram.

#### Scenario: Upload asset to HeyGen
- **WHEN** `uploadAsset(env, imageData, filename)` is called with a photo
- **THEN** it SHALL call `POST /v2/assets` with the image file
- **AND** return the `asset_id` from the response

#### Scenario: Create avatar group
- **WHEN** `createAvatarGroup(env, assetId, name)` is called
- **THEN** it SHALL call `POST /v2/photo_avatar/avatar_group` with the asset_id and name
- **AND** return the `group_id` from the response

#### Scenario: Generate talking photo (look)
- **WHEN** `generateTalkingPhoto(env, groupId, lookName)` is called
- **THEN** it SHALL call `POST /v2/photo_avatar/talking_photo` with the group_id
- **AND** return the `talking_photo_id` from the response
- **AND** this operation costs 4 HeyGen credits

#### Scenario: Check avatar training status
- **WHEN** `checkAvatarStatus(env, groupId)` is called
- **THEN** it SHALL poll the avatar group status endpoint
- **AND** return whether training is complete, in progress, or failed

### Requirement: Voice listing
The system SHALL provide a `listVoices(env)` function to retrieve available HeyGen voices for configuration.

#### Scenario: List available voices
- **WHEN** `listVoices()` is called
- **THEN** it SHALL call `GET /v2/voices`
- **AND** return a list of voices with `voice_id`, `name`, `language`, and `gender`

### Requirement: HeyGen API error handling
All HeyGen API calls SHALL handle errors gracefully without exposing API keys or internal details.

#### Scenario: Rate limit exceeded
- **WHEN** HeyGen API returns 429 Too Many Requests
- **THEN** the function SHALL return a typed error indicating rate limiting
- **AND** SHALL NOT retry automatically (let webhook/cron handle retry)

#### Scenario: Invalid API key
- **WHEN** HeyGen API returns 401 Unauthorized
- **THEN** the function SHALL return a typed error
- **AND** SHALL NOT expose the API key in logs or error messages

#### Scenario: Network error
- **WHEN** the HeyGen API call fails due to network issues
- **THEN** the function SHALL return a typed error with a generic message

#### Scenario: Insufficient credits
- **WHEN** HeyGen API returns a credits-related error
- **THEN** the function SHALL return a typed error indicating insufficient credits
- **AND** the user SHALL be notified to top up their HeyGen account

### Requirement: Generation timeout protection
The cron handler SHALL mark video drafts as "failed" if they have been in "generating" status for more than 30 minutes (safety net for missed webhooks).

#### Scenario: Job exceeds timeout
- **WHEN** a video draft has been in "generating" status for more than 30 minutes during cron execution
- **THEN** the handler SHALL first check HeyGen status via API (in case webhook was missed)
- **AND IF** HeyGen reports completed, process normally (download, store, notify)
- **AND IF** HeyGen reports still processing or failed, mark as "failed" and notify user

### Requirement: Sequential generation queue
The system SHALL NOT allow multiple concurrent video generation jobs. New requests SHALL be queued with status "queued" and processed sequentially.

#### Scenario: Queue when generating
- **WHEN** user approves a script while another video is generating
- **THEN** the video draft SHALL be created with status "queued"
- **AND** the user SHALL be notified of the queue position

#### Scenario: Queue advancement on webhook
- **WHEN** the webhook receives a completion/failure callback
- **THEN** after processing, it SHALL check for queued jobs and start the oldest one

#### Scenario: Queue advancement on cron
- **WHEN** the cron handler finds no "generating" jobs and there are "queued" jobs
- **THEN** it SHALL start the oldest queued job by calling HeyGen API
- **AND** update the status to "generating"

### Requirement: Credit cost estimation
The system SHALL estimate HeyGen credit cost before video generation and display it to the user.

#### Scenario: Cost estimation display
- **WHEN** user views the script preview before approval
- **THEN** the system SHALL display estimated credit cost based on:
  - Script word count → estimated duration
  - Engine selection (Avatar III = 1 credit/min, Avatar IV = 6 credits/min)
- **AND** round up to the nearest credit
