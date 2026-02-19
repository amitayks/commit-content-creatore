## Why

The twitter-poller is a separate Cloudflare Worker (~1,700 LOC) that shares the same D1 database and R2 bucket as content-bot. It runs on a 15-minute cron to poll followed Twitter accounts, score tweets via Gemini, send batch notifications, and auto-approve high-scoring tweets. It is still single-tenant (reads API keys from Worker env secrets) and duplicates OAuth, types, Telegram helpers, and prompt code from content-bot. With Phase 1 multi-tenant complete, the poller must be merged into content-bot and made multi-tenant so each user's followed accounts are polled with their own API keys. Additionally, the two separate cron schedules (hourly for draft/video publishing, every-15-min for polling) are unified into a single 15-minute cron with per-user fan-out, improving scheduled post precision from ~60 min to ~15 min.

## What Changes

- Merge all twitter-poller services into cloudflare-bot (dedup OAuth, types, Telegram, prompts; move poller-only services)
- Delete the twitter-poller Worker project
- Replace two cron schedules (`0 * * * *` + `*/15 * * * *`) with one unified `*/15 * * * *`
- Add `POST /internal/user-cron` endpoint — per-user fan-out target, authenticated with ADMIN_SECRET
- Cron coordinator: smart query for active users with pending work, then fan out via self-fetch to `/internal/user-cron`
- Each per-user isolate runs: poll accounts, publish due drafts, check stale videos, publish scheduled videos
- All poller DB queries scoped by `chat_id` (multi-tenant)
- Existing `publishScheduledDrafts` logic refactored into per-user functions called from the fan-out endpoint

## Capabilities

### New Capabilities
- `cron-fanout`: Unified cron coordinator that fans out per-user work via internal endpoint. Smart coordinator query, ADMIN_SECRET auth, per-user isolate execution.
- `twitter-polling`: Twitter account polling pipeline (poll, thread detection, scoring, batch notification, auto-approve) running per-user with hydrated env.

### Modified Capabilities
_(none — no existing spec-level behavior changes, only implementation consolidation)_

## Impact

- **Files moved/merged**: ~10 files from twitter-poller into cloudflare-bot/src/services/
- **Files deleted**: entire twitter-poller/ project directory
- **wrangler.toml**: cron schedule changes from `["0 * * * *"]` to `["*/15 * * * *"]`
- **index.ts**: new `/internal/user-cron` route, cron handler calls coordinator instead of `publishScheduledDrafts` directly
- **handlers/cron.ts**: refactored — coordinator + per-user work functions
- **services/x.ts**: gains read functions (getUserTweets, lookupUserByUsername, searchConversation) from twitter-poller's x-read.ts
- **services/db.ts**: gains poller DB functions (getWatchingTwitterAccounts, createTwitterTweet, etc.) — all scoped by chat_id
- **Env type**: may need `WORKER_URL` or self-URL resolution for fan-out fetch calls
