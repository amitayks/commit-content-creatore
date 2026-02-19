## 1. Dedup & Merge Shared Code

- [x] 1.1 Merge OAuth read functions from twitter-poller/x-read.ts into cloudflare-bot/services/x.ts (add `lookupUserByUsername`, `getUserTweets`, `searchConversation` — reuse existing `hmacSha1`, `percentEncode`, `generateOAuthHeader`)
- [x] 1.2 Merge poller-specific DB functions from twitter-poller/db.ts into cloudflare-bot/services/db.ts (getWatchingTwitterAccounts, createTwitterTweet, updateTwitterTweet, getPendingTweetsByAccount, getRecentTweetsByAccount, getScoredTweetsByBatchMessage, updateTwitterAccount, getTwitterAccountOverview, parseTwitterAccountConfig). Add `chatId` parameter to queries that need scoping.
- [x] 1.3 Verify cloudflare-bot types.ts already has all Twitter types (TwitterAccount, TwitterAccountConfig, TwitterTweet, TwitterTweetStatus, ThreadBufferEntry, TwitterAccountOverview). Add any missing types.

## 2. Move Poller-Only Services

- [x] 2.1 Move `poller.ts` to cloudflare-bot/services/poller.ts — update imports to use content-bot's types, db, x, telegram services. Change `pollTwitterAccounts(env)` to accept `chatId` and scope all operations to that user. Rename to `pollUserAccounts(env, chatId)`.
- [x] 2.2 Move `scoring.ts` to cloudflare-bot/services/scoring.ts — update imports (types, gemini API pattern from content-bot)
- [x] 2.3 Move `scoring-prompt.ts` to cloudflare-bot/services/scoring-prompt.ts — update imports
- [x] 2.4 Move `batch-notification.ts` to cloudflare-bot/services/batch-notification.ts — update imports to use content-bot's telegram service. Notifications go to the user's chatId (from hydrated env).
- [x] 2.5 Move `auto-approve.ts` to cloudflare-bot/services/auto-approve.ts — update imports to use content-bot's repost-generate.ts (pass `undefined` for personaOverride), content-bot's db.ts, and content-bot's types

## 3. Cron Fan-Out Infrastructure

- [x] 3.1 Add `WORKER_URL` to Env type in types.ts (optional string for fan-out self-fetch)
- [x] 3.2 Add `WORKER_URL` to wrangler.toml secrets documentation comments
- [x] 3.3 Create `routes/internal-cron.ts` — handler for `POST /internal/user-cron`. Validates ADMIN_SECRET from Authorization header, extracts chatId from request body, calls `hydrateEnv`, then runs per-user cron tasks (pollUserAccounts, publishUserDrafts, checkUserStaleVideos, publishUserScheduledVideos). Returns JSON status.
- [x] 3.4 Add `/internal/user-cron` route to index.ts with ADMIN_SECRET rate limiting

## 4. Refactor Cron Handler

- [x] 4.1 Create coordinator function in handlers/cron.ts — smart SQL query to find active users with pending work (watching accounts OR due drafts OR stale videos OR scheduled videos)
- [x] 4.2 Implement fan-out dispatcher — for each user from coordinator query, dispatch `fetch(WORKER_URL + '/internal/user-cron', ...)` with ADMIN_SECRET auth header and chatId in body. Use `ctx.waitUntil(Promise.allSettled(...))`.
- [x] 4.3 Refactor existing `publishScheduledDrafts` into per-user function `publishUserDrafts(env, chatId)` — takes already-hydrated env, only queries drafts for that chatId
- [x] 4.4 Refactor `checkStaleVideoGenerations` into `checkUserStaleVideos(env, chatId)` — takes hydrated env, scoped to user
- [x] 4.5 Refactor `publishScheduledVideos` into `publishUserScheduledVideos(env, chatId)` — takes hydrated env, scoped to user
- [x] 4.6 Update `scheduled()` handler in index.ts to call the new coordinator instead of `publishScheduledDrafts` directly. Pass `ctx` for `waitUntil`.

## 5. Wrangler & Config

- [x] 5.1 Update wrangler.toml cron from `["0 * * * *"]` to `["*/15 * * * *"]`
- [x] 5.2 Add `WORKER_URL` to wrangler.toml env vars (or document as secret)

## 6. Cleanup

- [x] 6.1 Delete twitter-poller/ project directory (confirm with user first)
- [x] 6.2 Verify build: run `npx wrangler deploy --dry-run` to ensure no import errors or type issues

## 7. Verification

- [x] 7.1 Verify: all poller imports resolve (no references to twitter-poller paths)
- [ ] 7.2 Verify: coordinator query returns correct users (test with at least admin user who has watching accounts)
- [ ] 7.3 Verify: `/internal/user-cron` rejects requests without valid ADMIN_SECRET
- [ ] 7.4 Verify: per-user poller runs with hydrated env (user's own X keys + Gemini key)
- [ ] 7.5 Verify: batch notifications arrive at the correct user's Telegram chat
- [ ] 7.6 Verify: scheduled draft publishing still works within the new 15-min cycle
