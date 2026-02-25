# HeyGen Avatar Integration

This spec defines the full HeyGen avatar integration: API client, Avatar IV video generation with motion prompts, photo avatar and look management, webhook handling, job queue, and credit estimation.

---

## 1. HeyGen API Client

### Requirement: HeyGen API client module
The system SHALL provide a `services/heygen.ts` module with functions for all HeyGen API interactions: video generation, job status, video download, asset upload, photo avatar creation, and webhook handling.

#### Scenario: API authentication
- **WHEN** any HeyGen API call is made
- **THEN** the `HEYGEN_API_KEY` environment variable SHALL be included as `x-api-key` header
- **AND** the key SHALL NOT be logged or exposed in error messages
- **AND** requests SHALL use base URL `https://api.heygen.com`

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

---

## 2. Avatar IV Video Generation

### Requirement: Avatar IV is the only video generation engine
The system SHALL use HeyGen's Avatar IV endpoint (`/v2/video/av4/generate`) for all video generation. No other engine option SHALL exist.

#### Scenario: Video generation uses av4 endpoint
- **WHEN** a video generation is triggered (approve & generate)
- **THEN** the system sends a POST request to `/v2/video/av4/generate` with the scene scripts, voice_id, image_key, and motion prompts

#### Scenario: No engine selection in configuration
- **WHEN** a user opens the video configuration screen
- **THEN** there SHALL be no engine toggle or engine display — Avatar IV is implied and hardcoded

### Requirement: Multi-scene video generation
The system SHALL send a multi-scene payload to the Avatar IV endpoint to create avatar videos.

#### Scenario: Create single-scene video
- **WHEN** `createVideo(env, config)` is called with a single scene
- **THEN** the request body SHALL include:
  - `video_inputs[0].character.type` = "talking_photo"
  - `video_inputs[0].character.image_key` = the look's image key
  - `video_inputs[0].voice.type` = "text"
  - `video_inputs[0].voice.input_text` = the scene's script text
  - `video_inputs[0].voice.voice_id` = the configured voice ID
  - `video_inputs[0].voice.speed` = 1.0 (default)
  - `video_inputs[0].voice.emotion` = the scene's emotion setting (Excited/Friendly/Serious/Soothing/Broadcaster)
  - `video_inputs[0].custom_motion_prompt` = the scene's motion prompt
  - `video_inputs[0].enhance_custom_motion_prompt` = true
  - `dimension.width` and `dimension.height` based on aspect ratio selection
  - `talking_style` = "expressive"
  - `callback_url` = the Worker's `/heygen-webhook` endpoint URL
- **AND** return the `video_id` from the response

#### Scenario: Create multi-scene video
- **WHEN** `createVideo(env, config)` is called with multiple scenes
- **THEN** each scene SHALL be a separate entry in the `video_inputs` array
- **AND** each scene MAY have different `voice.emotion` and `custom_motion_prompt` values
- **AND** HeyGen supports up to 50 scenes per video

#### Scenario: Avatar style options
- **WHEN** creating a video with Avatar IV
- **THEN** `character.avatar_style` MAY be set to "normal" (default), "closeUp", or "circle"

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
- **WHEN** aspect ratio is "9:16 Reel" -> dimension SHALL be `{ width: 1080, height: 1920 }`
- **WHEN** aspect ratio is "16:9 Landscape" -> dimension SHALL be `{ width: 1920, height: 1080 }`
- **WHEN** aspect ratio is "1:1 Square" -> dimension SHALL be `{ width: 1080, height: 1080 }`

### Requirement: Expressive talking style
All video generation requests SHALL set `talking_style` to `"expressive"` for maximum facial gesture intensity and emotional nuance.

#### Scenario: Talking style always expressive
- **WHEN** a video generation request is sent to HeyGen
- **THEN** the request SHALL include talking_style set to "expressive" (not "stable")

### Requirement: Video generation validates imageKey
Before calling the av4 endpoint, the system SHALL verify that `config.imageKey` is present and non-empty.

#### Scenario: imageKey present
- **WHEN** user approves video generation and `config.imageKey` is non-empty
- **THEN** video generation SHALL proceed normally

#### Scenario: imageKey missing
- **WHEN** user approves video generation and `config.imageKey` is empty or missing
- **THEN** the system SHALL show an error message indicating the look needs a photo re-upload and SHALL NOT call the HeyGen API

---

## 3. Per-Scene Motion Prompts

### Requirement: Per-scene custom motion prompts
Each scene in the video request SHALL include a `custom_motion_prompt` field describing the avatar's body movement, hand gestures, and facial expressions for that scene. The `enhance_custom_motion_prompt` field SHALL always be set to `true`.

#### Scenario: Motion prompt sent per scene
- **WHEN** the system sends a video generation request to HeyGen
- **THEN** each scene object SHALL contain `custom_motion_prompt` (string) and `enhance_custom_motion_prompt: true`

#### Scenario: Motion prompt describes physical movement
- **WHEN** a motion prompt is generated for a scene
- **THEN** it SHALL follow the format "[Body part/Subject] + [Action] + [Emotion/intensity]" in 1-2 short clauses using strong verbs

### Requirement: Gemini generates motion prompts alongside scripts
The Gemini video script generation system prompt SHALL instruct the AI to produce a `motionPrompt` field per scene, describing how the avatar should move and react during that segment.

#### Scenario: Script response includes motion prompts
- **WHEN** Gemini generates a video script
- **THEN** each scene in the JSON response SHALL include a `motionPrompt` field with a HeyGen-compatible motion description

#### Scenario: Motion prompts match scene content and emotion
- **WHEN** a scene has emotion "Excited" and discusses a new feature launch
- **THEN** the motion prompt SHALL describe energetic, enthusiastic body language (e.g., "Avatar raises hands excitedly, beaming with enthusiasm")

#### Scenario: Motion prompts follow HeyGen best practices
- **WHEN** a motion prompt is generated
- **THEN** it SHALL be 1-2 short clauses, use strong action verbs, describe concrete physical actions (not abstract emotions), and avoid negative phrasing

---

## 4. Look Management

### Requirement: HeyGenLook stores imageKey
Each `HeyGenLook` SHALL have an `imageKey: string` field that stores the `image_key` value returned by the HeyGen Upload Asset API. This field is used by the av4 video generation endpoint.

#### Scenario: Look created from photo upload
- **WHEN** a photo is uploaded via `uploadAsset()` and added to a character
- **THEN** the resulting look SHALL have `imageKey` set to the returned asset key

#### Scenario: Look with empty imageKey
- **WHEN** a look exists from sync but was never uploaded through our system
- **THEN** the look SHALL have `imageKey` set to empty string `''`

### Requirement: Character creation stores image_keys as initial looks
During character creation, after the avatar group is created from uploaded photos, the system SHALL persist the uploaded `image_key` values as initial looks on the character.

#### Scenario: Single photo character creation
- **WHEN** a user creates a character with 1 photo
- **THEN** the character SHALL have 1 look with `imageKey` set to the uploaded asset key, `talkingPhotoId` set to `''`, and `name` set to `'Photo 1'`

#### Scenario: Multi-photo character creation
- **WHEN** a user creates a character with N photos
- **THEN** the character SHALL have N looks, each with its respective `imageKey` from upload, `talkingPhotoId: ''`, and `name` set to `'Photo 1'` through `'Photo N'`

### Requirement: Add Look uses photo upload
The "Add Look" flow SHALL accept a photo upload (not an AI text prompt). The user sends a photo, which gets uploaded to HeyGen and added to the character's avatar group.

#### Scenario: User adds a look via photo
- **WHEN** user taps "Add Look" and sends a photo
- **THEN** the system SHALL upload the photo via `uploadAsset()`, call `addLooksToGroup()`, and store a new look with the `imageKey` from upload and `talkingPhotoId: ''`

#### Scenario: User sends text instead of photo
- **WHEN** user sends text during the add-look flow
- **THEN** the system SHALL prompt the user to send a photo instead

### Requirement: AI prompt-based look generation is removed
The AI look generation endpoint (`/v2/photo_avatar/look/generate`) SHALL NOT be used. Since the av4 video endpoint requires `image_key`, and the AI generation endpoint does not expose one, AI-generated looks cannot be used for video generation. Use photo upload to add new looks instead.

### Requirement: Sync looks merges with existing data
The `sync_looks` operation SHALL merge HeyGen's talking photo data into existing looks rather than replacing them, preserving stored `imageKey` values.

#### Scenario: Synced look matches existing look by name
- **WHEN** sync returns a talking photo whose name matches an existing look's name
- **THEN** the existing look's `talkingPhotoId` SHALL be updated and its `imageKey` SHALL be preserved

#### Scenario: Synced look has no matching existing look
- **WHEN** sync returns a talking photo that doesn't match any existing look
- **THEN** a new look SHALL be added with the synced `talkingPhotoId` and `imageKey: ''`

#### Scenario: Existing look not found in sync
- **WHEN** an existing look with `imageKey` is not found in sync results
- **THEN** the look SHALL be preserved (not removed) to retain its `imageKey`

### Requirement: Look selection populates imageKey on VideoConfig
When a user selects a look for video generation, `VideoConfig.imageKey` SHALL be set from the look's `imageKey` field.

#### Scenario: Look with imageKey selected
- **WHEN** user selects a look that has a non-empty `imageKey`
- **THEN** `config.imageKey` SHALL be set to that value

#### Scenario: Look without imageKey selected
- **WHEN** user selects a look that has empty `imageKey`
- **THEN** `config.imageKey` SHALL be set to `''`

---

## 5. Photo Avatar Creation

### Requirement: Photo Avatar creation flow
The system SHALL provide functions for creating HeyGen Photo Avatars through the bot, enabling character setup without leaving Telegram.

#### Scenario: Upload asset to HeyGen
- **WHEN** `uploadAsset(env, imageData, filename)` is called with a photo
- **THEN** it SHALL call `POST /v2/assets` with the image file
- **AND** return the `asset_id` (image key) from the response

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

---

## 6. Voice Listing

### Requirement: Voice listing
The system SHALL provide a `listVoices(env)` function to retrieve available HeyGen voices for configuration.

#### Scenario: List available voices
- **WHEN** `listVoices()` is called
- **THEN** it SHALL call `GET /v2/voices`
- **AND** return a list of voices with `voice_id`, `name`, `language`, and `gender`

---

## 7. Video Status and Download

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

---

## 8. Webhook Handler

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

---

## 9. Generation Queue and Timeout

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

### Requirement: Generation timeout protection
The cron handler SHALL mark video drafts as "failed" if they have been in "generating" status for more than 30 minutes (safety net for missed webhooks).

#### Scenario: Job exceeds timeout
- **WHEN** a video draft has been in "generating" status for more than 30 minutes during cron execution
- **THEN** the handler SHALL first check HeyGen status via API (in case webhook was missed)
- **AND IF** HeyGen reports completed, process normally (download, store, notify)
- **AND IF** HeyGen reports still processing or failed, mark as "failed" and notify user

---

## 10. VideoConfig and Data Model

### Requirement: VideoConfig simplified without engine fields
The `VideoConfig` type SHALL NOT contain `engine`, `avatarStyle`, or any engine-selection fields. The `VideoScene` type SHALL NOT contain `avatarStyle`. Both SHALL contain a `motionPrompt` field instead.

#### Scenario: VideoConfig has no engine field
- **WHEN** a VideoConfig object is created or loaded
- **THEN** it SHALL NOT have `engine` or `avatarStyle` properties
- **THEN** it SHALL NOT have `HeyGenEngine` or `HeyGenAvatarStyle` type references

#### Scenario: VideoScene includes motionPrompt
- **WHEN** a VideoScene object is created from Gemini output
- **THEN** it SHALL have a `motionPrompt` string field containing the motion description for that scene

### Requirement: Backward compatibility for saved presets and drafts
Existing saved presets and video drafts that contain `engine` and `avatarStyle` fields SHALL still load successfully. Unknown fields SHALL be silently ignored.

#### Scenario: Loading old preset with engine field
- **WHEN** a preset saved with `engine: "v3"` is loaded
- **THEN** the system SHALL ignore the `engine` field and load all other config values normally

#### Scenario: Viewing old draft with v3 config
- **WHEN** a completed video draft created with v3 engine config is viewed
- **THEN** the detail view SHALL display correctly without errors

---

## 11. Credit Estimation

### Requirement: Credit estimation uses Avatar IV rates only
Credit estimation SHALL always use Avatar IV rates (approximately 1 Premium Credit per 3 seconds of video). The system SHALL NOT display or calculate Avatar III rates.

#### Scenario: Credit cost displayed
- **WHEN** the system displays estimated credit cost for a video
- **THEN** it SHALL calculate using Avatar IV premium credit rates only, with no mention of alternative engines or rates

#### Scenario: Cost estimation in script preview
- **WHEN** user views the script preview before approval
- **THEN** the system SHALL display estimated credit cost based on script word count converted to estimated duration
- **AND** round up to the nearest credit

---

## 12. Configuration UI

### Requirement: Config UI removes engine-related controls
The video configuration view SHALL NOT display engine toggle, engine label, or avatar style selector. The removed space SHALL be reclaimed (no empty gaps).

#### Scenario: Config screen layout
- **WHEN** a user views the video configuration screen
- **THEN** the following controls SHALL NOT be present: engine toggle button, avatar style selector, engine display label
- **THEN** all remaining controls SHALL render without gaps
