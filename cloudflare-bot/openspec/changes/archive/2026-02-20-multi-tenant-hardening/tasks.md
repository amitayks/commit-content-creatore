## 1. Replace Hardcoded Worker URLs

- [x] 1.1 `inputs/commit-sha.ts:76` — replace hardcoded URL with `${env.WORKER_URL}${imageUrl}`
- [x] 1.2 `actions/draft-detail.ts:60` — replace hardcoded URL with `${env.WORKER_URL}${imageUrl}`
- [x] 1.3 `actions/compose.ts:132` — replace hardcoded URL with `${env.WORKER_URL}${imageUrl}`
- [x] 1.4 `actions/tweet-view-draft.ts:61` — replace hardcoded URL with `${ctx.env.WORKER_URL}${imageUrl}`
- [x] 1.5 `actions/repost-preview.ts:193` — replace hardcoded URL with `${ctx.env.WORKER_URL}${imageUrl}`
- [x] 1.6 `routes/heygen-webhook.ts:96` — replace hardcoded URL with `${env.WORKER_URL}/media/${r2Key}`
- [x] 1.7 `services/video-publish.ts:202` — replace hardcoded URL with `${env.WORKER_URL}/media/${videoDraft.video_url}`
- [x] 1.8 `views/video-studio.ts:198` — replace hardcoded URL with `${env.WORKER_URL}/media/${draft.video_url}`
- [x] 1.9 `actions/video-actions.ts:422` — replace hardcoded URL with `${ctx.env.WORKER_URL}/heygen-webhook`

## 2. Add chat_id to DB Queries (Critical)

- [x] 2.1 `getScoredTweetsByBatchMessage(env, batchMessageId)` in `db.ts` — add `chatId` parameter, add `AND chat_id = ?` to query. Update callers: `batch-page.ts:21`, `tweet-generate.ts:91`
- [x] 2.2 `getTwitterTweet(env, tweetId)` in `db.ts` — add `chatId` parameter, add `AND chat_id = ?` to query. Update caller: `tweet-generate.ts:20` (remove post-fetch ownership check at line 26)
- [x] 2.3 `getRecentTweetsByAccount(env, accountId)` in `db.ts` — add `chatId` parameter, verify account ownership via twitter_accounts.chat_id before querying. Update callers: `repost-generate.ts:35`, `persona-bootstrap.ts:34`
- [x] 2.4 `getTwitterAccountOverview(env, accountId)` in `db.ts` — add `chatId` parameter, verify account ownership. Update callers: `views/accounts.ts:95`, `repost-generate.ts:33`, `actions/repost-preview.ts:88`

## 3. Add chat_id to DB Queries (Defense-in-depth)

- [x] 3.1 `getRepoOverview(env, repoId)` in `db.ts` — add optional `chatId` parameter, verify repo ownership via repos.chat_id when provided. Update callers that have chatId available.
- [x] 3.2 `getVideoDraftByHeygenId(env, heygenVideoId)` in `db.ts` — add doc comment explaining this is intentionally unscoped (external webhook with opaque UUID). No query change needed.

## 4. Harden isAdmin Check

- [x] 4.1 `security.ts:41` — remove `|| env.TELEGRAM_CHAT_ID` fallback. If `ADMIN_CHAT_ID` is not set, return false.

## 5. Verification

- [x] 5.1 Verify build: `npx wrangler deploy --dry-run`
- [x] 5.2 Grep for any remaining hardcoded `keisarcontentcreator` references in `src/`
- [x] 5.3 Grep for any DB queries on user-scoped tables missing `chat_id` WHERE clause (spot check)
