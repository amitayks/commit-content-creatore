## 1. Database Schema & Types

- [x] 1.1 Add `video_drafts` table to schema.sql with all columns (id, chat_id, repo_id, status, script, caption, twitter_caption, title, config, heygen_video_id, video_url, reference_sha, scheduled_at, created_at, updated_at) and indexes on status and heygen_video_id
- [x] 1.2 Add `video_published` table to schema.sql (id, chat_id, video_draft_id, repo_id, twitter_url, instagram_url, caption, published_at)
- [x] 1.3 Add `video_presets` table to schema.sql (id, chat_id, name, config, created_at)
- [x] 1.4 Create D1 migration script for all three new tables with indexes
- [x] 1.5 Add TypeScript types to types.ts:
  - `VideoConfig` (commitDepth, tone, length, characterId, lookId, talkingPhotoId, voiceId, aspectRatio, engine, emotion, avatarStyle, background, captions, textOverlay, manualInstructions)
  - `VideoScene` (scriptText, emotion, avatarStyle, textOverlay, direction)
  - `VideoScriptResponse` (title, scenes[], caption, twitterCaption, totalWordCount)
  - `VideoDraft`, `VideoPublished`, `VideoPreset`
  - `HeyGenJobStatus`, `HeyGenWebhookPayload`
  - `HeyGenCharacter` (heygenGroupId, name, personality, defaultTalkingPhotoId, voiceId, defaultEmotion, status, createdAt)
  - `HeyGenLook` (talkingPhotoId, name, characterGroupId)
- [x] 1.6 Add compose state types to `ChatContext` in types.ts: `videoCompose`, `characterCreate`, `lookCreate`

## 2. DB Service Functions for Video

- [x] 2.1 Add video draft CRUD functions to db.ts: `createVideoDraft`, `getVideoDraft`, `getVideoDraftsByStatus`, `getVideoDraftsByRepo`, `updateVideoDraft`, `deleteVideoDraft`
- [x] 2.2 Add `getVideoDraftByHeygenId(env, heygenVideoId)` — for webhook callback lookup
- [x] 2.3 Add video published CRUD: `createVideoPublished`, `getVideoPublishedByRepo`
- [x] 2.4 Add video preset CRUD: `createVideoPreset`, `getVideoPresets`, `deleteVideoPreset`
- [x] 2.5 Add `getLastPublishedVideoForRepo(env, chatId, repoId)` — returns the most recent published video for "since last video" commit range
- [x] 2.6 Add `getVideoDraftsByStatusForCron(env, status)` — for cron to query generating/queued/scheduled video drafts
- [x] 2.7 Add `getStaleGeneratingDrafts(env, olderThanMinutes)` — for cron timeout fallback

## 3. HeyGen API Integration

- [x] 3.1 Create `services/heygen.ts` with HeyGen API client — authentication via `x-api-key` header, base URL `https://api.heygen.com`, typed request helper
- [x] 3.2 Implement `createVideo(env, config)` — calls `POST /v2/video/generate` with multi-scene `video_inputs` array, character (talking_photo), voice (text + emotion), dimension, background, caption flag, text overlay, and `callback_url` for webhook
- [x] 3.3 Implement `checkVideoStatus(env, videoId)` — calls `GET /v1/video_status.get`, returns typed status object (pending/processing/completed/failed with videoUrl)
- [x] 3.4 Implement `downloadVideo(env, videoUrl)` — downloads completed video with 120s timeout, returns ArrayBuffer + metadata, validates size ≤200MB
- [x] 3.5 Implement `uploadAsset(env, imageData, filename)` — calls `POST /v2/assets`, returns asset_id for Photo Avatar creation
- [x] 3.6 Implement `createAvatarGroup(env, assetId, name)` — calls `POST /v2/photo_avatar/avatar_group`, returns group_id
- [x] 3.7 Implement `generateTalkingPhoto(env, groupId, lookName)` — calls `POST /v2/photo_avatar/talking_photo`, returns talking_photo_id (costs 4 credits)
- [x] 3.8 Implement `checkAvatarStatus(env, groupId)` — polls avatar training status endpoint
- [x] 3.9 Implement `listVoices(env)` — calls `GET /v2/voices`, returns list with voice_id, name, language, gender
- [x] 3.10 Add error handling: rate limits (429), auth failures (401), insufficient credits, network errors, timeout protection — all return typed errors without exposing API key
- [x] 3.11 Add dimension mapping helper: aspect ratio string → `{ width, height }` (9:16→1080x1920, 16:9→1920x1080, 1:1→1080x1080)
- [x] 3.12 Add credit cost estimation helper: (wordCount, engine) → estimated credits

## 4. HeyGen Webhook Handler

- [x] 4.1 Add `/heygen-webhook` POST route to Worker fetch handler (separate from Telegram webhook route)
- [x] 4.2 Implement webhook validation — verify payload contains video_id matching a "generating" draft, reject unknown requests with 400
- [x] 4.3 Implement success callback handler — lookup draft by heygen_video_id, download video, store in R2, update draft status to "completed", update video_url, notify user via Telegram with preview + action buttons
- [x] 4.4 Implement failure callback handler — lookup draft, update status to "failed", notify user with failure reason
- [x] 4.5 Implement queue advancement after webhook processing — check for queued drafts, start oldest one

## 5. Video Script Generation

- [x] 5.1 Create `VIDEO_SCRIPT_SYSTEM_PROMPT` in gemini.ts — dedicated prompt for multi-scene video scripts with per-scene emotion, avatar style, text overlay, direction, and length calibration
- [x] 5.2 Implement `generateVideoScript(env, options)` function — takes repo overview, commits, tone, length, manual instructions, character personality, engine, emotion, textOverlay enabled flag; calls Gemini; returns parsed VideoScriptResponse with scenes array
- [x] 5.3 Add script length calibration logic — map length settings to target word counts and scene counts (30s→70w/1scene, 60s→160w/1-2scenes, 90s→240w/2-3scenes, 2m→320w/2-4scenes, 3m→480w/3-6scenes, 5m→800w/5-10scenes)
- [x] 5.4 Add dual caption generation — Instagram caption (max 2200 chars with hashtags) and Twitter caption (max 280 chars, concise standalone version)
- [x] 5.5 Add script validation — verify JSON structure, non-empty scriptText per scene, valid emotion values (Excited/Friendly/Serious/Soothing/Broadcaster), word count within 30% of target
- [x] 5.6 Add emotion value validation and fallback — replace invalid emotion values with config default

## 6. Video Storage

- [x] 6.1 Add `storeVideo(env, videoDraftId, data, mimeType)` to storage.ts — stores video in R2 at `videos/{videoDraftId}/video.mp4` with content type metadata
- [x] 6.2 Add video size validation (max 200MB)
- [x] 6.3 Add `/media/:key` endpoint to Worker — serves video/image files from R2 with correct Content-Type, Content-Length, Accept-Ranges headers, path traversal prevention, publicly accessible (no auth)
- [x] 6.4 Add `sendVideoToTelegram(env, chatId, videoDraftId)` — reads from R2, sends via Telegram sendVideo API with caption and action buttons, handles >50MB fallback to link

## 7. Video Studio Dashboard Views

- [x] 7.1 Create `views/video-studio.ts` with `renderVideoStudioHome(env, chatId)` — shows standalone button + repo list (repos with overviews)
- [x] 7.2 Create `renderVideoRepoHome(env, chatId, repoId)` — shows status category buttons with counts (drafts, published, scheduled, approved, create new)
- [x] 7.3 Create `renderVideoList(env, chatId, repoId, status, page)` — paginated video list for each status category with truncated script preview, length, date
- [x] 7.4 Create `renderVideoDetail(env, chatId, videoDraftId)` — shows script preview, caption, config summary (engine, emotion, aspect ratio, captions, etc.), status, action buttons
- [x] 7.5 Create `renderVideoConfig(env, chatId, repoId, config)` — shows all configuration toggles/buttons with current selections: character, look, tone, length, engine, emotion, aspect ratio, background, captions, text overlay, commit depth, manual instructions, presets
- [x] 7.6 Create `renderScriptPreview(env, chatId, videoDraftId)` — shows generated script with per-scene breakdown (scenes, emotions), caption, estimated credit cost, and Approve/Regenerate/Edit Config/Cancel buttons

## 8. Video Configuration Flow

- [x] 8.1 Add callback handlers for video config field toggles: commit depth, tone, length, character, look, aspect ratio, engine, emotion, background, captions, text overlay, avatar style
- [x] 8.2 Implement manual instructions compose mode — enter/exit compose, buffer text messages, handle photos (store in R2), save/cancel
- [x] 8.3 Implement "Create Video" action — validate config completeness (character, tone, length required), call `generateVideoScript()`, create video draft with script, render script preview with credit estimate
- [x] 8.4 Implement "Approve & Generate" action — call HeyGen `createVideo()` with multi-scene payload + callback_url, update draft status to generating/queued, display confirmation with queue position
- [x] 8.5 Implement "Regenerate Script" action — call Gemini again with same config, update draft script
- [x] 8.6 Implement character selector view — list configured characters from settings with name and status
- [x] 8.7 Implement look selector view — list looks for selected character
- [x] 8.8 Implement engine selector view — Avatar III / Avatar IV toggle with credit cost indicators
- [x] 8.9 Implement emotion selector view — Excited/Friendly/Serious/Soothing/Broadcaster buttons with character default pre-selected
- [x] 8.10 Implement config summary display — show all current selections in the config view

## 9. Video Preset System

- [x] 9.1 Add "Save as Preset" button to video config view — prompts for name, saves current config (all fields including engine, emotion, background, captions, text overlay)
- [x] 9.2 Add "Load Preset" button — shows list of saved presets, loads selected into config
- [x] 9.3 Add "Delete" button on preset items

## 10. Video Publishing Pipeline

- [x] 10.1 Implement `publishVideoToTwitter(env, videoDraft)` — chunked media upload for video files from R2, create tweet with media + twitter_caption (280 chars)
- [x] 10.2 Implement `publishVideoToInstagram(env, videoDraft)` — create media container with public R2 video URL, poll for processing, publish, return URL
- [x] 10.3 Add platform selection UI to video publish action — checkboxes for Twitter and Instagram (Instagram greyed out if not configured)
- [x] 10.4 Handle multi-platform publish results — create video_published record, report per-platform success/failure
- [x] 10.5 Add video scheduling action — set scheduled_at, update status to "scheduled"

## 11. Cron Handler Extensions

- [x] 11.1 Add webhook fallback to cron — query stale generating drafts (>30 min), check HeyGen status via API, process completed (download + store + notify), mark truly stale as failed
- [x] 11.2 Add queue processing to cron — when no generating jobs exist, start oldest queued job via HeyGen API
- [x] 11.3 Add scheduled video publishing to cron — query video drafts with status=scheduled and scheduled_at <= now, publish each to configured platforms
- [x] 11.4 Add generation timeout — mark as failed if generating >30 minutes and HeyGen also reports not completed

## 12. Callback Router & Navigation

- [x] 12.1 Register all video studio callback patterns in the callback router (view:video_studio, view:video_repo:*, view:video_list:*, view:video_detail:*, action:video_*, action:video_engine:*, action:video_emotion:*, action:video_captions:*, action:video_overlay:*, action:video_bg:*)
- [x] 12.2 Add "Video Studio" button to main dashboard home view
- [x] 12.3 Add video compose mode message routing — check videoCompose.active before regular message handling
- [x] 12.4 Add character creation compose mode routing — check characterCreate.active with step-based routing (awaiting_photo → awaiting_name)
- [x] 12.5 Add look creation compose mode routing — check lookCreate.active with step-based routing
- [x] 12.6 Implement message routing priority order: characterCreate → lookCreate → videoCompose → existing compose → regular

## 13. Video Settings UI

- [x] 13.1 Add "Video Settings" button to bot settings view with subsections: Characters, Voices, Defaults, HeyGen Account, Instagram
- [x] 13.2 Implement character creation flow through bot — compose mode: prompt for photo → upload to HeyGen assets → prompt for name → create avatar group → generate default look → poll training → notify completion
- [x] 13.3 Implement character listing view — display all characters with name, status (ready/training/failed), and Looks/Edit/Remove buttons
- [x] 13.4 Implement character edit — allow editing display name and personality description
- [x] 13.5 Implement character removal with confirmation (local only, does not delete from HeyGen)
- [x] 13.6 Implement look creation flow through bot — compose mode: prompt for look name → call generateTalkingPhoto → poll training → notify completion
- [x] 13.7 Implement look listing per character with Remove button
- [x] 13.8 Implement voice configuration per character — list HeyGen voices (from API), select voice_id, select default emotion
- [x] 13.9 Implement default settings view — default aspect ratio, max video length, default character, default engine (Avatar III/IV), default background, default captions toggle
- [x] 13.10 Implement HeyGen account settings — API key configuration with test validation, credit cost reference display
- [x] 13.11 Implement Instagram credentials input (Business Account ID, Access Token) with validation test call and token expiry warning
