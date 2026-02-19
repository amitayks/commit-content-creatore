## Context

Phase 1 (multi-tenant-phase-1) is complete: the content-bot Worker supports multiple users, each with encrypted API keys in D1, env hydration at request time, and per-user cron notifications. However, the twitter-poller remains a separate single-tenant Worker (~1,700 LOC) that duplicates OAuth, types, Telegram helpers, and AI prompt code. It reads API keys from Worker secrets (single user only).

Currently two cron schedules exist across two workers:
- content-bot: `0 * * * *` (hourly) — publish scheduled drafts, check stale videos, publish scheduled videos
- twitter-poller: `*/15 * * * *` — poll Twitter accounts, score, notify, auto-approve

Both share the same D1 database and R2 bucket.

## Goals / Non-Goals

**Goals:**
- Merge twitter-poller code into content-bot (single Worker deployment)
- Unify both crons into a single `*/15 * * * *` schedule with per-user fan-out
- Make all poller operations multi-tenant (per-user API keys via env hydration)
- Eliminate code duplication (OAuth, types, Telegram, prompts)
- Each user gets their own Cloudflare isolate for cron work (true isolation, independent CPU budgets)

**Non-Goals:**
- Changing poller business logic (scoring thresholds, thread detection, batch notification format)
- Adding rate limiting to the poller (defer to later)
- Phase 3 work (GitHub webhook fan-out, repos table constraint)
- Phase 4 work (HeyGen multi-tenant)
- Admin dashboard for monitoring poller status

## Decisions

### D1: Single cron at `*/15 * * * *` with coordinator fan-out

**Decision:** Replace both cron schedules with one 15-minute cron. A lightweight coordinator queries for users with pending work and dispatches per-user sub-requests.

**Rationale:** Scheduled post precision improves from ~60 min to ~15 min. One code path instead of two separate cron handlers. Each user gets their own isolate with independent 30s CPU budget — critical for polling which can take 10-15s wall time per user.

**Alternative rejected:** Keep two crons — would require cron dispatcher logic (`event.cron` matching) and leave the sequential user-loop bottleneck in the hourly cron.

### D2: Self-fetch to `/internal/user-cron` for fan-out

**Decision:** The coordinator fans out by calling `fetch()` to the Worker's own URL at `/internal/user-cron?chatId=X` with ADMIN_SECRET auth. Each request spawns a new isolate.

**Rationale:** Cloudflare Workers don't support background tasks or parallelism within one isolate. Self-fetch is the documented pattern for fan-out. Each sub-request gets its own 30s budget and runs in parallel.

**Self-URL resolution:** Use the `request.url` from the incoming cron event — but cron events don't have a request. Instead, use a constructed URL from the Worker's route. The Worker URL is known at deploy time. We'll use an env var `WORKER_URL` (or derive from the Worker name) to construct the self-fetch URL. Alternatively, hardcode the workers.dev URL or use `Service Bindings` — but the simplest approach is an env var.

**Alternative rejected:** Service bindings (Worker-to-Worker RPC) — adds complexity and config overhead for no benefit when self-fetch works fine.

### D3: Merge OAuth into single x.ts file

**Decision:** Add read functions (getUserTweets, lookupUserByUsername, searchConversation) to the existing `services/x.ts` which already has OAuth helpers and write functions (postTweet, uploadMedia).

**Rationale:** Both files have identical `hmacSha1`, `percentEncode`, `generateOAuthHeader` implementations. One file, one set of OAuth helpers, both read and write operations.

### D4: Use cloudflare-bot's repost-generate.ts (superset)

**Decision:** Keep cloudflare-bot's version which has `personaOverride` parameter. The twitter-poller's version is a simplified subset — the auto-approve flow just passes `undefined` for personaOverride.

**Rationale:** Diff shows cloudflare-bot's version is strictly more capable. No code changes needed for auto-approve — it already works with the existing signature.

### D5: Move poller-only services as-is, then adapt

**Decision:** Copy `poller.ts`, `scoring.ts`, `scoring-prompt.ts`, `batch-notification.ts`, `auto-approve.ts` into cloudflare-bot's services/, then update imports and add chat_id scoping.

**Rationale:** These files have no equivalent in content-bot. The logic is correct; they just need import path updates and multi-tenant scoping (accept `chatId` parameter, scope DB queries).

### D6: Smart coordinator query

**Decision:** The coordinator runs a single SQL query joining users with their pending work (watching accounts, due drafts, stale videos, scheduled videos) and only fans out to users who actually have work.

**Rationale:** Avoids waking isolates for users with nothing to do. With 50 users but only 5 having active accounts, this saves 45 unnecessary requests.

### D7: Poller DB queries scoped by chat_id

**Decision:** All twitter-poller DB queries that currently operate globally (e.g., `getWatchingTwitterAccounts()` returns ALL watching accounts) are changed to accept and filter by `chat_id`.

**Rationale:** In multi-tenant, each user's isolate should only see and process their own data. The `twitter_accounts` table already has a `chat_id` column.

### D8: fire-and-forget fan-out with `ctx.waitUntil`

**Decision:** The coordinator dispatches all fan-out requests and uses `ctx.waitUntil(Promise.allSettled(...))` to let them run without blocking the cron response. Individual sub-request failures don't affect other users.

**Rationale:** Cron handler must return quickly. Per-user work may take 10-15s. `waitUntil` keeps isolates alive after the cron returns. `allSettled` ensures one user's failure doesn't abort others.

## Risks / Trade-offs

**[Risk] Self-fetch URL resolution** — Worker needs to know its own URL for fan-out.
→ Mitigation: Add `WORKER_URL` env var (e.g., `https://content-bot.keisarcontentcreator.workers.dev`). Set once at deploy time.

**[Risk] 15-min cron = 4x more coordinator runs** — The coordinator query runs 4x more often than the old hourly cron.
→ Mitigation: The smart query is lightweight (single D1 read). If zero users have work, coordinator returns immediately. Cost is negligible.

**[Risk] Fan-out request count** — Each active user = one HTTP request to self every 15 minutes.
→ Mitigation: Well within Cloudflare's 10M req/day limit. 50 users × 96 cycles/day = 4,800 req/day.

**[Risk] Poller code assumes single-tenant env** — All poller services read `env.X_API_KEY`, `env.GOOGLE_API_KEY` directly.
→ Mitigation: The fan-out endpoint calls `hydrateEnv(env, chatId)` before running any poller code. Since hydration overrides these env fields, all poller code works without modification to how it reads keys. Only DB queries need chat_id scoping.

**[Trade-off] repost-generate.ts divergence** — The cloudflare-bot version has extra `personaOverride` parameter that the twitter-poller version lacks.
→ Accept: Keep cloudflare-bot version. Auto-approve flow passes `undefined` for the new param, preserving existing behavior.

## Migration Plan

1. Merge code (no deployment needed — code changes only)
2. Update wrangler.toml cron schedule
3. Deploy content-bot with merged code
4. Verify polling works for admin user
5. Delete twitter-poller Worker from Cloudflare dashboard (or leave dormant)
6. Delete twitter-poller/ project directory

Rollback: If fan-out fails, the old twitter-poller Worker can be re-deployed independently. Since they share D1, no data migration is needed.

## Open Questions

- **WORKER_URL**: Should this be an env var, or can we derive it from `wrangler.toml` name + `.workers.dev` suffix? An env var is more explicit and handles custom domains.
