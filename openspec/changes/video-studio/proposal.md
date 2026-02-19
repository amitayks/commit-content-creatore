## Why

Tweets with images drive engagement, but short-form video (Instagram Reels, Twitter video) dramatically outperforms static content on social platforms. The current system generates tweets and images — extending it to generate AI avatar videos of the user presenting feature updates creates a complete multi-format content pipeline. Using HeyGen's API v2 with Photo Avatars and voice configuration, the system can produce studio-quality talking-head videos from AI-generated scripts, fully automated through the existing Telegram bot interface.

## What Changes

- Add HeyGen API v2 integration for multi-scene video generation with per-scene emotion, avatar style, text overlays, and built-in captions
- Add Photo Avatar creation and management directly through the Telegram bot (upload photo → create avatar group → train looks — no need to leave the bot)
- Add a dedicated "Video Studio" section in the Telegram dashboard with its own draft/publish/schedule lifecycle
- Add video configuration UI: commit depth, tone, manual instructions, character/look selection, aspect ratio, length, engine (Avatar III/IV), voice emotion, background, captions toggle, text overlay toggle
- Add a dedicated multi-scene video script generation system prompt for Gemini that produces per-scene scripts with emotion, avatar style, and text overlay — leveraging repo overview (from `repo-context-system`) for context
- Add script preview and approval step with credit cost estimate before sending to HeyGen
- Add HeyGen webhook callback handler (`/heygen-webhook` endpoint) for near-instant notification on video completion, with cron as fallback safety net
- Add video storage in R2 bucket (HeyGen URLs expire after 7 days — immediate download required)
- Add dual caption generation — Instagram-optimized (2200 chars) and Twitter-optimized (280 chars) captions
- Add video preset/template system for reusable configurations
- Add video publishing pipeline to Instagram Reels and Twitter video
- Add comprehensive video settings: character/look creation through bot, voice configuration per character, default engine/emotion/background/captions, HeyGen account status, Instagram credentials
- Depends on `repo-context-system` change for repo overview context in script generation

## Capabilities

### New Capabilities
- `video-studio-dashboard`: Dedicated Telegram UI section for video management — per-repo video lists (drafts, published, scheduled, approved), create-new flow, video preview, and navigation
- `video-configuration`: Video creation parameter UI — commit depth, tone, manual instructions, character/look picker, aspect ratio (9:16/16:9/1:1), length (30s-5m), engine (Avatar III/IV with credit indicators), voice emotion (Excited/Friendly/Serious/Soothing/Broadcaster), background (color/image), captions toggle, text overlay toggle, and preset save/load
- `video-script-generation`: Dedicated Gemini prompt for multi-scene video scripts — per-scene script text with emotion, avatar style, text overlay, and direction; dual caption generation; script validation
- `heygen-integration`: HeyGen API v2 client — multi-scene video generation with `callback_url` webhook, Photo Avatar creation (upload asset → create group → generate talking photo), voice listing, video status checking, video download with expiry awareness, credit cost estimation
- `video-publish-pipeline`: Video publishing to Instagram Reels (Meta Content Publishing API) and Twitter video (chunked media upload), with multi-platform selection
- `video-storage`: Video file management in R2 — immediate download from HeyGen (7-day URL expiry), serve via `/media/:key` endpoint (publicly accessible for Instagram), Telegram video preview with 50MB fallback
- `video-settings`: Full video configuration through the bot — character creation (photo upload → HeyGen avatar training), look creation, voice configuration per character, default settings (engine/emotion/background/captions/aspect ratio/max length), HeyGen account status, Instagram credentials with expiry warning

### Modified Capabilities
- `smart-dashboard`: Dashboard home adds "Video Studio" navigation button
- `telegram-bot`: New callback routes for video studio, HeyGen webhook endpoint, character/look/video compose modes with message routing priority

## Impact

- **Database**: New `video_drafts` table (with indexes on status and heygen_video_id), new `video_published` table, new `video_presets` table
- **External APIs**: HeyGen API v2 (new dependency — video generation, Photo Avatar creation, voice listing), Instagram Content Publishing API (new dependency), Twitter media upload extended for video
- **R2 Storage**: Video files (~20-150MB each) stored alongside images; HeyGen URLs expire in 7 days so immediate download is critical
- **Cloudflare Worker**: New `/heygen-webhook` endpoint for near-instant video completion notification; cron serves as fallback safety net and handles queue advancement + scheduled publishing
- **Gemini service**: New multi-scene video script system prompt with per-scene emotion/style output and dual caption generation
- **Telegram UI**: Major new view tree — Video Studio home → repo list → video list → video detail → create flow → config steps → script preview → generation status; new compose modes for character creation, look creation, and manual instructions
- **Environment variables**: `HEYGEN_API_KEY`, `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_BUSINESS_ACCOUNT_ID` (plus existing X credentials for video upload)
- **HeyGen Credits**: Avatar III = 1 credit/min, Avatar IV = 6 credits/min, Photo Avatar training = 4 credits/look
- **Dependencies**: This change depends on `repo-context-system` being implemented first for repo overview context in script generation
