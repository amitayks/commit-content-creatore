## Context

The system currently generates tweets + images from GitHub webhooks via a Telegram bot running on Cloudflare Workers (D1 + R2 + Gemini). The tweet content pipeline is mature with multi-perspective prompts, structured image generation, scheduling, and a full draft lifecycle. The `repo-context-system` change (dependency) adds persistent repo overviews to give Gemini project context.

This change adds AI avatar video generation using HeyGen's API, with a dedicated "Video Studio" dashboard in the Telegram bot. Videos are separate from tweets — they have their own configuration, lifecycle, and publishing pipeline.

## Goals / Non-Goals

**Goals:**
- Generate studio-quality talking-head videos from AI-generated scripts using HeyGen API v2
- Provide a dedicated Video Studio UI in Telegram with full draft/publish/schedule lifecycle
- Support flexible video configuration (commit depth, tone, length, character, look, aspect ratio, emotion, background, captions)
- Multi-scene video support with per-scene emotion and style control
- Script preview and approval before expensive video generation
- Async video generation via HeyGen webhook callbacks (near-instant notification)
- Publish videos to Instagram Reels and Twitter
- Preset system for reusable video configurations
- Character and look creation/management directly through the Telegram bot

**Non-Goals:**
- In-process video editing (re-cut, re-record sections) — regenerate full video instead
- Real-time/streaming video (HeyGen pre-rendered only)
- Multi-character videos (single presenter per video)
- Automatic video generation on every webhook (intentional creation only)
- YouTube publishing (future consideration)
- Background music or sound design (v1 is speech only)

## Decisions

### Decision 1: Separate video_drafts table vs extending drafts table

**Chosen: Separate `video_drafts` table**

Videos and tweets have fundamentally different schemas — videos need script text, HeyGen job ID, character config, scene data, video URL, and captions. Extending the existing `drafts` table would require nullable columns for both tweet-specific and video-specific fields, creating confusion. A separate table keeps concerns clean and allows independent evolution.

Alternative considered: Adding a `content_type` column to `drafts` with type-specific JSON in `content` — rejected because it complicates every existing query and view that assumes tweet structure.

### Decision 2: Async video generation via HeyGen webhook callbacks

**Chosen: HeyGen webhook callbacks with cron fallback**

HeyGen supports two notification mechanisms:
1. **Per-video `callback_url`** — passed in each `POST /v2/video/generate` request. HeyGen sends a POST to this URL when the video completes or fails.
2. **Account-level webhooks** — configured via API, fires events `avatar_video.success` and `avatar_video.fail` for all videos.

We use the per-video `callback_url` as the primary notification channel, pointing to a `/heygen-webhook` endpoint on our Worker. This gives near-instant notification when a video completes (no polling delay).

The existing hourly cron serves as a **fallback safety net** only — it checks for any `generating` jobs that somehow missed a webhook callback (network failure, etc.) and for timeout enforcement (>30 min = failed).

The cron also handles:
- Processing the queue (starting the next queued job when no active generation exists)
- Publishing scheduled videos when `scheduled_at <= NOW()`

Alternative considered: Pure cron polling — rejected because it adds up to 1 hour delay between video completion and user notification. With webhook callbacks, notification is nearly instant.

### Decision 3: Video storage in R2

**Chosen: Store videos in R2 at `videos/{videoDraftId}/video.mp4`**

HeyGen video URLs expire after **7 days**, so videos MUST be downloaded to R2 immediately upon completion. R2 free tier provides 10GB storage. At ~20MB per 30s video, that's ~500 videos before hitting the free tier. For expected volume (5-50 videos/month), R2 is sufficient.

Videos are served via a `/media/:key` endpoint (extending the existing `/image/:key` pattern). This also provides the publicly accessible URL needed for Instagram Reels publishing.

Alternative considered: Telegram channel as storage — rejected because it creates a dependency on Telegram availability and makes video URL referencing fragile. R2 is the source of truth.

### Decision 4: Script generation as a separate Gemini call with multi-scene output

**Chosen: Dedicated video script prompt returning per-scene structured output**

HeyGen's v2 API supports up to 50 scenes per video, each with its own script text, voice emotion, avatar style, and optional text overlay. We leverage this by having Gemini generate a **per-scene script** that maps directly to HeyGen's scene model.

Each scene includes: script text for that segment, suggested voice emotion (Excited/Friendly/Serious/Soothing/Broadcaster), avatar style hint, and optional text overlay for key points.

For shorter videos (30s-60s), Gemini produces 1-2 scenes. For longer videos (3m-5m), it may produce 5-10 scenes with natural transitions.

### Decision 5: Fixed length options, not continuous slider

**Chosen: [30s] [60s] [90s] [2m] [3m] [5m] fixed buttons**

Telegram inline keyboards work best with discrete options. Six fixed length options cover all practical use cases and map cleanly to script word-count targets.

HeyGen plan limits: Free = max 3min/720p, Pro = max 5min/1080p, Scale = max 30min/4K. We cap at 5m for v1 since most social video content is under 3 minutes.

### Decision 6: Commit range options

**Chosen: [Latest only] [Last 3] [Last 5] [Since last video] [Custom]**

"Since last video" tracks the last video's commit SHA per repo and includes everything new since then. This makes regular "update videos" effortless.

### Decision 7: Character and look creation through the Telegram bot

**Chosen: Full character lifecycle management through the bot**

HeyGen's Photo Avatar API enables creating characters entirely through the bot:

1. **Upload photo** — User sends a photo to the bot (in a character creation compose mode)
2. **Upload to HeyGen** — Bot calls `POST /v2/assets` to upload the photo, gets an `asset_id`
3. **Create Avatar Group** — Bot calls `POST /v2/photo_avatar/avatar_group` with the asset_id, gets a `group_id`
4. **Generate Looks** — Bot calls `POST /v2/photo_avatar/talking_photo` with group_id + look parameters, gets a `talking_photo_id`
5. **Training** — HeyGen trains the avatar (costs 4 credits per look). Bot polls or receives webhook when ready.

This is a game-changer — users don't need to leave Telegram to set up their avatar. The bot guides them through each step with clear prompts and progress updates.

Each character can have multiple looks (different outfits, backgrounds, poses). Looks are generated from the same avatar group but with different parameters.

Voice configuration is stored per-character — the user selects a HeyGen voice_id and default emotion for each character in settings.

### Decision 8: HeyGen engine selection — Avatar III vs Avatar IV

**Chosen: Per-video engine toggle, default to Avatar III**

- **Avatar III**: 1 credit/minute, good quality, faster generation
- **Avatar IV**: 6 credits/minute, premium quality, slower generation

Default to Avatar III for cost efficiency. Users can toggle to Avatar IV per-video for important content. The engine choice affects the `avatar_style` parameter (Avatar III has `normal` only; Avatar IV supports `normal`, `closeUp`, `circle`).

### Decision 9: Instagram Reels integration approach

**Chosen: Meta Content Publishing API with async publishing**

Instagram Reels upload follows a two-step flow: (1) create a media container with the video URL, (2) publish the container after processing completes. The video must be in R2 with a publicly accessible URL for Meta to fetch it.

This requires: Meta Business Account, Facebook Page linked to Instagram, Instagram Content Publishing API access, and a long-lived access token.

### Decision 10: HeyGen concurrency management

**Chosen: Respect plan-based concurrent limits with local queue**

HeyGen concurrent generation limits vary by plan:
- Free: 1 concurrent job
- Pro: 3 concurrent jobs
- Scale: 6 concurrent jobs

For v1, we implement a simple sequential queue (1 job at a time) regardless of plan. This avoids complexity and works for expected volume. The queue is managed via draft status: `queued` → `generating` → `completed`. The cron handler and webhook both participate in queue advancement.

## Risks / Trade-offs

**[Risk: HeyGen API changes or pricing increases]** → Mitigation: Abstract HeyGen calls behind a `VideoProvider` interface so we can swap providers later.

**[Risk: Video generation takes longer than expected (>10min)]** → Mitigation: The webhook provides near-instant notification. The cron fallback enforces a 30-minute timeout and marks as failed.

**[Risk: R2 storage fills up with large videos]** → Mitigation: Monitor storage usage. 5min videos at 1080p can be 100-150MB. Add cleanup mechanism later if needed.

**[Risk: HeyGen rate limits]** → Mitigation: Sequential queue with one active job at a time. Rate limit errors return typed errors for clean handling.

**[Risk: Instagram API token expiration]** → Mitigation: Long-lived tokens last 60 days. Add token health check and user notification before expiry.

**[Risk: Script quality inconsistency]** → Mitigation: Script preview + approve step catches bad scripts before burning HeyGen credits.

**[Risk: HeyGen video URL expiry]** → HeyGen video download URLs expire after 7 days. Mitigation: Download to R2 immediately upon webhook notification. Never rely on HeyGen URLs for long-term storage.

**[Risk: Photo Avatar training failures]** → Mitigation: Training can fail if photo quality is poor. Provide clear guidance on photo requirements (well-lit, front-facing, high resolution). Handle training failures gracefully with user notification.

**[Risk: HeyGen credit burn on failed videos]** → Credits are consumed even for failed generations. Mitigation: Script approval step prevents accidental generation. Clear cost indication before "Approve & Generate" (e.g., "This ~2min video will use ~2 credits").

**[Trade-off: No video editing]** → Accepted. Regenerating is simpler than building an edit flow.

**[Trade-off: Sequential queue limits throughput]** → Accepted for v1. Can increase concurrency later based on HeyGen plan.

## Open Questions — RESOLVED

- **HeyGen API specifics**: RESOLVED — Full API v2 documented. `POST /v2/video/generate` for creation, `GET /v1/video_status.get` for status, webhook callbacks for notification, Photo Avatar APIs for character creation.
- **Instagram API access**: Requires Meta app review process. Should start early. Still an open process dependency.
- **Video format requirements**: RESOLVED — HeyGen outputs MP4 with H.264. Matches Instagram Reels requirements. Aspect ratio is set at generation time via `dimension` parameter.
- **R2 public URL for Instagram**: RESOLVED — Videos served via Worker `/media/:key` endpoint provide publicly accessible URLs for Meta's servers.
- **Caption/subtitle in video**: RESOLVED — HeyGen supports built-in caption burning via `caption: true` in the video generation request. No separate step needed.
