## Context

The bot has three content creation paths: auto-generated (from GitHub PRs), handwritten (manual compose), and auto-repost (from followed accounts via poller). The missing piece is manual repost — letting users paste any tweet URL and generate a quote-tweet draft on demand. This uses the same AI generation pipeline as auto-reposts but with a different trigger and richer context for unknown accounts.

Current architecture:
- `/generate` → `commit_sha` input handler → GitHub API → Gemini → draft
- `/handwrite` → compose mode with multi-message support → draft
- Auto-repost → poller detects tweets → scoring → batch notification → generate action → draft

The manual repost follows the `/generate` pattern most closely: command → awaiting input → process → show draft.

## Goals / Non-Goals

**Goals:**
- Add `/repost` command with dashboard button for manual tweet repost generation
- Parse tweet URLs, fetch tweet content + author profile, show preview before generating
- Support thread detection and full thread fetch for thread URLs
- Detect duplicate reposts and warn the user
- Let user select tone before generation (including new "sarcastic" tone)
- Cache persona data for non-followed accounts for future reuse
- Prompt user to follow unknown accounts after successful generation
- Add "sarcastic" tone to the existing account config tone cycle

**Non-Goals:**
- Auto-detecting tweet URLs from any message (explicit command/button only)
- Supporting non-Twitter/X URLs (Instagram, LinkedIn, etc.)
- Batch manual reposts (one URL at a time)
- Editing the generated content inline in the preview step (use existing edit flow after draft creation)

## Decisions

### 1. URL Parsing Strategy
Parse `x.com` and `twitter.com` URLs to extract username and tweet ID. Support formats:
- `https://x.com/username/status/1234567890`
- `https://twitter.com/username/status/1234567890`
- Bare `x.com/username/status/1234567890` (without https)

**Why**: These cover 99% of shared tweet URLs. Keep regex simple and explicit.

### 2. Tweet Fetch: Single API Call with Expansions
Use `GET /2/tweets/:id` with `tweet.fields` and `author.fields` expansions to get tweet content + author profile in one call. If the tweet is a thread (has `conversation_id` and is a self-reply chain), do a follow-up `searchConversation()` call to get the full thread.

**Why**: Minimizes API calls. The existing `searchConversation` in x-read.ts already handles thread fetch.

### 3. Persona Cache Table
New `persona_cache` table with columns: `username` (UNIQUE), `user_id`, `display_name`, `persona`, `topics`, `bio`, `created_at`, `updated_at`. TTL-based: entries older than 30 days get refreshed on next use.

**Why alternative (reuse twitter_account_overviews)**: Rejected because overviews are tied to `account_id` (followed accounts). The cache is for any username, independent of following. Separate table keeps concerns clean.

### 4. Preview-then-Generate Flow
After fetching the tweet, show a preview message with tweet text, author info, engagement metrics, thread indicator, and tone selector buttons. User must explicitly click "Generate" to proceed.

**Why**: Prevents wasted API calls on wrong URLs, gives user control over tone per-repost, and provides a natural confirmation step.

### 5. Tone Selection UI
Show tone as a row of buttons in the preview. Current selection is highlighted. Default: professional (or the account's configured tone if followed).

Tones: professional, casual, analytical, enthusiastic, witty, **sarcastic**

The sarcastic tone prompt: sharp, incisive Twitter-style humor — makes strong points with wit and a respectful edge. Not mean-spirited, but cleverly pointed.

### 6. Follow Prompt After Generation
After creating the draft from an unknown account, send a separate message: "Want to follow @username for automatic reposts?" with [Follow] [No thanks] buttons. The Follow button triggers the existing `addAccountAction` flow (creates account record, sets baseline).

**Why**: Low friction way to grow the followed accounts list. Separate message so it doesn't interfere with the draft detail view.

## Risks / Trade-offs

- **X API rate limits on tweet fetch**: Manual reposts add API calls beyond the poller's usage. Risk is low for manual use (user-triggered, not automated). → Mitigation: Use cached persona when available to avoid redundant profile lookups.
- **Persona cache staleness**: Cached personas for non-followed accounts may become outdated. → Mitigation: 30-day TTL with refresh on next use. Acceptable for manual repost context.
- **Thread fetch for old tweets**: `searchConversation` uses `/tweets/search/recent` which only covers last 7 days. Older threads won't be fully fetchable. → Mitigation: Fall back to just the single tweet text if thread fetch fails. Show "(partial thread)" indicator.
- **Sarcastic tone misuse**: AI-generated sarcasm could be too harsh or miss the mark. → Mitigation: The prompt emphasizes "respectful sarcasm" — sharp points but never personal attacks. User reviews before publishing.
