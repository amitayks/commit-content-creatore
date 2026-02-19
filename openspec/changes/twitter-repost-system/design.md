## Context

The bot is a Cloudflare Worker (`content-bot`) that monitors GitHub repos via webhooks, generates social media content using Gemini, and publishes to X/Twitter through a Telegram approval flow. It uses D1 (SQLite), R2 (images), and runs an hourly cron for scheduled publishing.

We're adding a "follow X accounts → detect tweets → AI score → generate quote tweets → approve → publish" pipeline. This mirrors the GitHub flow but uses polling instead of webhooks, adds AI relevance scoring, and introduces quote-tweet publishing.

The existing worker handles Telegram webhooks, GitHub webhooks, media serving, and hourly cron (scheduled publishing + video checks). Adding 15-min Twitter polling to the same worker risks cron collisions and CPU budget conflicts. A separate worker is cleaner from day one.

## Goals / Non-Goals

**Goals:**
- Follow X accounts by @username, poll their timelines every 15 min
- AI-score tweets for relevance, filter noise before draft creation
- Generate persona-aware quote-tweet drafts with dedicated prompts
- Batch notification UX — one Telegram message per poll cycle
- Detect and buffer threads, score as single units
- Separate worker architecture for isolation
- Store all fetched tweets for persona context (last 20-50 sent to AI)
- Inline day-picker scheduling UX for all draft types

**Non-Goals:**
- Reply-based engagement (quote tweets only for now)
- Auto-publishing without user approval (auto-approve creates drafts, not publishes)
- Real-time streaming (polling is sufficient at this scale)
- Multi-strategy engagement (quote/reply/original — future)
- Engagement analytics feedback loop — future
- Per-account daily rate limits — future (user controls volume via threshold + manual approval)

## Decisions

### 1. Separate Cloudflare Worker (`twitter-poller`)

**Decision:** Create a new worker in `twitter-poller/` at the repo root, alongside `cloudflare-bot/`.

**Rationale:** Cron isolation — the existing hourly cron handles tweet publishing + video checks. Adding 15-min polling + AI scoring to the same worker risks CPU time collisions and makes debugging harder. Separate workers get independent CPU budgets.

**Architecture:**
```
cloudflare-bot/           (existing)
  wrangler.toml           → crons = ["0 * * * *"]
  src/                    → Telegram webhook, GitHub webhook, hourly cron

twitter-poller/           (new)
  wrangler.toml           → crons = ["*/15 * * * *"]
  src/                    → Twitter polling, AI scoring, batch notifications

Both bind to same D1 + R2 + secrets
```

**Alternative considered:** Single worker with separate cron entries. Rejected because Cloudflare triggers all crons in the same `scheduled()` handler, requiring manual dispatch and shared CPU budget.

### 2. Shared D1 Database, Same Schema File

**Decision:** Both workers bind to the same D1 database (`content-bot-db`). New tables are added to `cloudflare-bot/schema.sql`. The twitter-poller reads/writes the same `drafts` table for repost drafts and the same `chat_state` for Telegram.

**Rationale:** The Telegram bot (content-bot) needs to display repost drafts in its views, read account settings, and publish quote tweets. Sharing the DB avoids any sync layer.

**New tables:**
- `twitter_accounts` — followed accounts with config + last_tweet_id
- `twitter_account_overviews` — AI-generated persona per account
- `twitter_tweets` — all fetched tweets (for persona context + batch tracking)

**Modified tables:**
- `drafts` — add `original_tweet_id TEXT` and `original_tweet_url TEXT` columns

### 3. Two-Stage AI Pipeline with Separate Prompts

**Decision:** Three new Gemini prompt files, each in its own service file in the twitter-poller:

| Stage | File | Purpose |
|-------|------|---------|
| Scoring | `services/scoring-prompt.ts` | Batch-scores all new tweets in one call. Returns `{tweet_id, score, reason}[]` |
| Generation | `services/repost-prompt.ts` | Generates quote-tweet content for a single tweet. Persona-aware, history-aware |
| Persona | `services/persona-prompt.ts` | Bootstraps account overview using Gemini web search grounding |

**Rationale:** Separate files allow independent refinement. The scoring prompt must be analytical and concise. The generation prompt must be creative and persona-aware. Mixing them degrades both.

**Scoring is batched** — one Gemini call per poll cycle with all new tweets concatenated. This saves tokens and stays within Worker CPU limits.

### 4. Thread Detection via conversation_id Buffering

**Decision:** Use X API v2 `conversation_id` + `referenced_tweets` fields to detect threads. Buffer incomplete threads in `twitter_tweets` table with `status='buffered'`. Track stale polls in `twitter_accounts.thread_buffer` (JSON field).

**Algorithm:**
1. Fetch timeline with `tweet.fields=conversation_id,in_reply_to_user_id,referenced_tweets`
2. For each tweet: if `referenced_tweets` contains `type="replied_to"` AND `in_reply_to_user_id` == author's own user_id → thread continuation
3. Group by `conversation_id`, store with `status='buffered'`
4. Each poll: check buffered conversations. If no new tweets for 2 consecutive polls (30 min), fetch full thread via `GET /2/tweets/search/recent?query=conversation_id:ID from:username`
5. Score the complete thread as one unit

**Alternative considered:** Separate `twitter_thread_buffer` table. Rejected — the tweets table + a JSON field on accounts is simpler and avoids an extra table.

### 5. Batch Notification with Edit-in-Place

**Decision:** Each poll cycle sends ONE Telegram message listing all scored tweets above threshold. Each item has [Generate] and [Open Tweet ↗] buttons. When user clicks Generate, the message edits in place to show "Draft created" with [View Draft] button.

**Message ID tracking:** Store `batch_message_id` on each `twitter_tweets` row so the action handler can reconstruct and edit the batch message.

**New poll cycles send new messages** (not appended to old ones). Old batch messages remain functional — their Generate buttons still work via tweet ID references.

**Auto-approve accounts:** Their tweets skip the batch notification Generate step. Drafts are created during the poll with `status='approved'`. The batch notification shows them as "Auto-approved" with [View Draft].

### 6. Repost Drafts in Existing Drafts Table

**Decision:** Repost drafts use the existing `drafts` table with `source='repost'`. New columns `original_tweet_id` and `original_tweet_url` link to the quoted tweet.

**Draft display:** The `pr_title` field is repurposed for reposts as `@username | first-100-chars-of-tweet`. The `pr_number` field stores 0 (not applicable). The `commit_sha` stores the original tweet ID (for idempotency).

**Rationale:** Reusing the drafts table means the entire approval flow, scheduling, publishing, and view system works with minimal changes. The `source` field already differentiates draft types.

### 7. Quote Tweet Publishing

**Decision:** Extend `postTweet()` options with `quoteTweetId?: string`. When present, adds `quote_tweet_id` to the X API v2 request body.

For repost drafts, the publish pipeline calls `postTweet()` with the single tweet text + `quoteTweetId`. If the draft is a thread (rare for quote tweets), the first tweet is the quote and subsequent tweets are replies.

### 8. Scheduling UX — Day Picker

**Decision:** Replace free-text datetime entry with a two-step inline flow for ALL draft types:
1. Show inline buttons for next 7 days (using user's timezone)
2. After day selection, prompt for HH:MM text input
3. Combine and store as UTC

This is implemented in the existing content-bot worker (it's a Telegram UI change, not poller-related).

### 9. X API Read Functions — Shared Service

**Decision:** Create `twitter-poller/src/services/x-read.ts` with the read-only X API functions. Copy the OAuth helpers from `cloudflare-bot/src/services/x.ts` (they're pure functions).

Functions needed:
- `lookupUserByUsername(env, username)` → user ID, name, bio, profile image
- `getUserTweets(env, userId, sinceId?, maxResults?)` → tweets with conversation_id, referenced_tweets
- `searchConversation(env, conversationId, username)` → full thread tweets

The existing content-bot keeps its write functions (`postTweet`, `postThread`, `uploadMedia`). The poller only reads.

### 10. Chunked Account Processing

**Decision:** Process accounts in chunks of 10 per cron run. With 40 accounts, each gets polled every ~60 minutes (4 cycles × 15 min). This stays well within Worker CPU limits.

Chunk assignment: simple round-robin based on `account.id` hash modulo 4. Stable across runs.

**Alternative considered:** Poll all 40 every cycle. Rejected for CPU budget risk — 40 API calls + thread detection + one Gemini scoring call could exceed 30s.

## Risks / Trade-offs

**[Risk] Cloudflare Worker CPU timeout** → Chunked processing (10 accounts/cycle). If still tight, the worker architecture supports extracting to multiple workers later.

**[Risk] Gemini scoring prompt drift** → Separate prompt file allows independent tuning. Start with a broad prompt, refine post-launch based on actual scored results.

**[Risk] Thread detection false positives** → Self-replies that aren't threads (e.g., corrections, addendums). Mitigation: if a "thread" is just 2 tweets, treat the second as standalone unless it clearly continues the first (let AI score both interpretations).

**[Risk] Stale batch notifications** → Old batch messages with Generate buttons may reference tweets that are hours old. Mitigation: the quote-tweet content is generated at click time, not at poll time, so it's always fresh. The relevance may be lower, but the user chose to click.

**[Risk] X API rate limits** → User timeline is 900 req/15min (user auth). At 10 accounts per cycle, we use 10 of 900. Thread search uses separate rate limit (300/15min). Well within limits.

**[Trade-off] pr_number/pr_title/commit_sha repurposing** → Using existing draft columns for different semantics (pr_title → "@user | tweet text") is pragmatic but impure. Alternative: add dedicated columns. Decision: repurpose for now to minimize schema changes; the source field disambiguates interpretation.

## Open Questions

- Exact Gemini model to use for scoring (flash for speed/cost vs pro for accuracy)
- Whether the poller worker needs its own /setup endpoint for DB migrations or shares the existing one
- Persona overview auto-update frequency (every N polls? only on bootstrap?)
