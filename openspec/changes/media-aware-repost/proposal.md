## Why

Repost generation (both auto via poller and manual via `/repost`) currently only sends tweet text to the AI. When tweets contain images (charts, screenshots, product demos) or videos (with thumbnails), the AI is blind to visual content and generates less contextual reposts. This is especially impactful for announcements that rely on visual media.

## What Changes

- Add `media_url` column to `twitter_tweets` D1 table to store media URLs at poll time
- Expand X API calls in both poller (`getUserTweets`) and content-bot (`getTweetById`) to request media expansions
- For images: store the actual image URL; for videos: store the `preview_image_url` (thumbnail)
- Both are treated as images when sent to Gemini — a single unified approach
- Add `analyzeMedia: boolean` toggle to `TwitterAccountConfig` for followed accounts
- Manual `/repost` always analyzes media (no toggle — user explicitly chose the tweet)
- Media is sent to Gemini only during **generation**, NOT during scoring (too many images per batch)
- Update both `twitter-poller` and `cloudflare-bot` repost generation to support multimodal Gemini input
- Update repost prompts to instruct AI about attached images

## Capabilities

### New Capabilities
- `media-analysis`: Fetching, storing, and sending tweet media (images + video thumbnails) to Gemini for context-aware repost generation

### Modified Capabilities

## Impact

- **D1 schema**: New migration adding `media_url` column to `twitter_tweets`
- **twitter-poller**: `x-read.ts` (media expansions), `poller.ts` (store media_url), `repost-generate.ts` (multimodal Gemini), `repost-prompt.ts` (image awareness)
- **cloudflare-bot**: `repost-generate.ts` already partially supports images (manual repost); needs alignment. `tweet-generate.ts` (batch generate flow) needs media passthrough. Account config toggle.
- **Both workers**: `types.ts` updated for `analyzeMedia` config field
- **X API**: No additional API calls — media comes via expansions on existing calls
