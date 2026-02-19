## Why

The bot currently monitors GitHub repos and auto-generates social media posts from PRs/commits. To grow audience beyond original content, we need to engage with influential Twitter/X accounts by quote-tweeting their posts (releases, announcements, technical content). This creates a "repost" pipeline — follow accounts, detect new tweets, AI-score for relevance, generate quote-tweet drafts, and publish with user approval.

## What Changes

- **New "Accounts" section** in Telegram bot — follow/unfollow X accounts by @username, configure per-account settings (relevance threshold, tone, auto-approve, language, hashtags, image generation)
- **New "RePosts" subsection** in Drafts — browse, approve, schedule, and publish AI-generated quote-tweet drafts with same capabilities as existing auto/handwrite subsections
- **New dedicated Cloudflare Worker** (`twitter-poller`) — runs on 15-min cron, polls followed accounts for new tweets, detects threads, AI-scores for relevance, generates drafts for auto-approve accounts, sends batch Telegram notifications
- **Separate worker architecture** — the new worker connects to the same D1 database and R2 bucket but runs independently from the existing `content-bot` worker, preventing cron jobs from interfering with each other
- **AI scoring system** — two-stage Gemini pipeline: Stage 1 batch-scores all new tweets for relevance (dedicated scoring prompt), Stage 2 generates quote-tweet content per selected tweet (dedicated generation prompt)
- **Thread detection** — groups self-reply tweets by `conversation_id`, buffers incomplete threads across poll cycles, fetches complete threads via search endpoint
- **Account persona system** — bootstrap AI-generated persona overviews using Gemini web search grounding from X profile data, store and send to AI with each content generation for persona-aware quote tweets
- **Tweet history storage** — persist all fetched tweets for persona context, send last 20-50 to AI during content generation for continuity and "past reference" capability
- **Batch notifications** — single Telegram message per poll cycle listing scored tweets with inline Generate/Open buttons, edit-in-place when user acts
- **Quote tweet support** — extend `postTweet()` with `quote_tweet_id` parameter
- **Scheduling UX improvement** — inline day-picker buttons (next 7 days) then hour/minute input, applies to all draft types

## Capabilities

### New Capabilities
- `twitter-account-management`: Account CRUD, settings configuration, persona bootstrap, account list/detail views in Telegram
- `twitter-polling`: Dedicated worker, 15-min cron polling, timeline fetching, thread detection and buffering, last-tweet-id tracking
- `twitter-scoring`: AI relevance scoring system prompt, batch scoring per poll cycle, threshold filtering per account
- `twitter-repost-generation`: AI content generation for quote tweets, persona-aware prompts, tweet history context, draft creation with source='repost'
- `twitter-batch-notifications`: Batch Telegram messages with scored tweets, inline Generate/Open buttons, edit-in-place on interaction
- `twitter-worker`: Separate Cloudflare Worker deployment, shared D1/R2 bindings, independent 15-min cron, chunked account processing
- `schedule-day-picker`: Inline day-picker buttons for next 7 days then hour/minute text input, replaces free-text datetime entry for all draft types

### Modified Capabilities
- `smart-dashboard`: Add "Accounts" button to home menu
- `view-system`: Add RePosts category to draft categories, add accounts list/detail views, add batch notification views
- `draft-quick-actions`: Support `source='repost'` drafts in quick actions with same approve/publish/delete/schedule flow
- `publish-pipeline`: Support quote-tweet publishing via `quote_tweet_id` alongside existing thread publishing
- `route-handlers`: Register new account-related callback handlers, actions, and input handlers in router

## Impact

- **New files**: ~15-20 new files across both workers (services, views, actions, commands, handlers, prompts)
- **Database**: 3 new tables (`twitter_accounts`, `twitter_account_overviews`, `twitter_tweets`), 2 new columns on `drafts` (`original_tweet_id`, `original_tweet_url`)
- **Infrastructure**: New Cloudflare Worker (`twitter-poller`) with own wrangler config, shared D1/R2 bindings
- **APIs**: New X API v2 read endpoints (user lookup, user timeline, search for threads)
- **AI**: 3 new Gemini system prompts (scoring, repost generation, persona bootstrap)
- **Dependencies**: No new npm dependencies expected
