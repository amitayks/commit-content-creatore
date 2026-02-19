## Context

The system has two repost generation paths:
1. **Auto (twitter-poller)**: Polls followed accounts → scores tweets → generates reposts for high-scoring ones
2. **Manual (content-bot)**: User sends `/repost` with a tweet URL → preview → generate

Currently, both paths only send tweet text to Gemini. Images and video thumbnails attached to tweets are ignored. The content-bot's manual repost flow was just updated to support images, but only for that single flow. The poller path and the content-bot's batch generate flow remain text-only.

The X API returns media via `attachments.media_keys` expansion. For photos, it provides `url` (full image). For videos, it provides `preview_image_url` (thumbnail). Both can be treated identically as images when sent to Gemini.

## Goals / Non-Goals

**Goals:**
- Store media URLs (`media_url`) in `twitter_tweets` at poll time
- Send media to Gemini during repost **generation** (not scoring) for better context
- Unify media handling across all generation flows (poller auto-generate, content-bot batch generate, manual repost)
- Add `analyzeMedia` toggle to `TwitterAccountConfig` for per-account control
- Manual `/repost` always analyzes media (no toggle)

**Non-Goals:**
- Media-aware scoring (too many images per batch, complex mapping)
- Full video analysis (only thumbnails — actual video files are too large for Workers)
- Storing multiple media items per tweet (first photo or video thumbnail is sufficient)

## Decisions

### 1. Single `media_url` column, not a separate media table
**Rationale**: Each tweet has at most one relevant media item for AI context (first photo or video thumbnail). A separate table adds complexity with no benefit. A nullable `TEXT` column on `twitter_tweets` is simplest.

### 2. Unified image treatment for photos and video thumbnails
**Rationale**: Both resolve to an image URL. The AI doesn't need to know if it's a photo or a video thumbnail — it just sees an image. Single `analyzeMedia` toggle covers both. Simplifies settings UI and code paths.

### 3. Media only during generation, not scoring
**Rationale**: Scoring processes 5-20 tweets per batch in one Gemini call. Attaching 10+ images would be expensive, slow, and complex to map (which image belongs to which tweet). The text is sufficient for relevance scoring. Media adds value when generating the actual repost text for a single tweet.

### 4. Poller `getUserTweets` requests media expansions
**Rationale**: Store media_url at poll time so it's available when generation happens later. Avoids a second X API call during generation. The expansion adds minimal overhead to the existing API call.

### 5. `analyzeMedia` defaults to `true`
**Rationale**: Media analysis improves output quality. Users who don't want it can toggle off. The cost (one image fetch per generation) is minimal.

## Risks / Trade-offs

- **Image fetch latency**: Fetching + base64 encoding adds ~200-500ms per generation → Acceptable since generation already takes 2-5 seconds
- **Workers memory**: Large images could approach memory limits → X API images are typically <2MB; Workers has 128MB limit. Safe margin.
- **Stale media URLs**: X media URLs may expire over time → Media is fetched during generation which happens within hours of polling. If it fails, generation continues text-only (graceful fallback).
- **X API rate limits**: Adding media expansion to `getUserTweets` → No additional API calls, just extra fields on existing calls. No rate limit impact.
