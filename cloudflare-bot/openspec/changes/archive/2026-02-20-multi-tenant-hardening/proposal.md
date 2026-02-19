## Why

A security audit found 3 classes of multi-tenant issues after Phase 1-3 implementation:
1. **9 hardcoded worker URLs** — all use the old `https://content-bot.keisarcontentcreator.workers.dev` instead of `env.WORKER_URL`
2. **6 DB queries missing `chat_id` filters** — cross-tenant data access possible via ID enumeration or Telegram message_id collision
3. **1 fragile admin check fallback** — `isAdmin()` falls back to `env.TELEGRAM_CHAT_ID` which is the user's chatId after hydration

These need to be fixed before onboarding additional users.

## What Changes

- **Replace all 9 hardcoded worker URLs** with `env.WORKER_URL` across image, video, and callback URL construction
- **Add `chat_id` filters** to `getScoredTweetsByBatchMessage`, `getRecentTweetsByAccount`, `getTwitterAccountOverview`, `getTwitterTweet` DB functions
- **Fix fetch-then-check pattern** in `tweet-generate.ts` to filter at query level instead of post-fetch
- **Harden `isAdmin()`** to not fall back to `TELEGRAM_CHAT_ID` (require `ADMIN_CHAT_ID` explicitly)
- **Add `chat_id` filter** to `getVideoDraftByHeygenId` and `getRepoOverview` for defense-in-depth

## Capabilities

### New Capabilities
- `tenant-isolation`: Enforce chat_id scoping on all DB queries that access user-owned data, eliminating cross-tenant data access vectors.

### Modified Capabilities
_(no existing specs to modify)_

## Impact

- **Files modified (hardcoded URLs)**: `inputs/commit-sha.ts`, `actions/draft-detail.ts`, `actions/compose.ts`, `actions/tweet-view-draft.ts`, `actions/repost-preview.ts`, `routes/heygen-webhook.ts`, `services/video-publish.ts`, `views/video-studio.ts`, `actions/video-actions.ts`
- **Files modified (DB queries)**: `services/db.ts`, `actions/batch-page.ts`, `actions/tweet-generate.ts`, `services/repost-generate.ts`, `services/persona-bootstrap.ts`, `views/accounts.ts`, `actions/repost-preview.ts`, `routes/heygen-webhook.ts`
- **Files modified (admin check)**: `services/security.ts`
- **No schema changes** — all queries already have `chat_id` columns, just missing WHERE clauses
- **No breaking API changes** — all fixes are internal
