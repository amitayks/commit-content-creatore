## Why

The bot currently has two content creation triggers: "Generate" (from commit/PR) and "Handwrite" (manual compose). The Twitter Repost system only creates drafts automatically via the poller for followed accounts. Users need a way to manually create a repost from any tweet URL — even from accounts they don't follow — with the same AI-powered content generation. This completes the content creation trifecta and gives users full control over what they repost.

## What Changes

- Add `/repost` command and "🔄 RePost" button on the home dashboard
- User pastes a tweet URL → bot fetches tweet content + author profile → shows preview with engagement metrics → user confirms → AI generates quote-tweet draft with image
- Thread-aware: if the tweet is part of a thread, fetch and show the full thread
- Duplicate detection: warn if a draft/published repost already exists for that tweet
- Tone selector in preview step: let user pick tone (professional, casual, analytical, enthusiastic, witty, sarcastic) before generating
- For followed accounts: use stored persona overview + account config
- For unknown accounts: fetch profile via X API, do a lightweight Gemini web search for context, cache the persona for future use
- After generating from an unknown account: prompt "Want to follow @username for automatic reposts?"
- Add "sarcastic" tone option to both the manual repost flow and the existing account config system

## Capabilities

### New Capabilities
- `manual-repost`: The `/repost` command flow — URL parsing, tweet preview, tone selection, AI generation, draft creation, follow-up prompt
- `persona-cache`: Lightweight persona caching for non-followed accounts — fetch profile + web search, store for future manual reposts without requiring a full account follow

### Modified Capabilities
- `repost-tones`: Add "sarcastic" tone to TwitterAccountConfig and repost generation prompts. Sarcastic tone should be witty and incisive but respectful — makes sharp points with Twitter-style humor.

## Impact

- **content-bot**: New command `/repost`, new input handler, new views (preview, tone picker), updated repost-prompt.ts for sarcastic tone, account-config.ts tone cycle, home.ts button
- **Types**: Add 'sarcastic' to tone union type, add 'repost_url' to awaiting_input union, add persona cache table/type
- **Database**: New `persona_cache` table for non-followed account personas
- **X API service**: Add `getTweetById()` function for fetching a single tweet by ID
- **Router**: New command, input handler, action handlers for preview/tone/follow prompt
