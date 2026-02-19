## Context

The GitHub webhook pipeline is the last single-tenant piece. Currently:
- `createWebhook` in `services/webhook.ts` uses `env.GITHUB_WEBHOOK_SECRET` (shared Worker secret) as the webhook signing secret
- `handleGitHubWebhook` in `handlers/github-webhook.ts` verifies signatures against that same shared secret
- Content generation (`generateContent`, `getPR`) runs with the admin's API keys (raw `env`, not hydrated)
- `sendNotification` sends to `env.TELEGRAM_CHAT_ID` (admin) instead of the repo owner's chatId
- `add-repo.ts` hardcodes the worker URL when creating webhooks
- `services/github.ts` uses `env.GITHUB_OWNER` for commit search queries

Phase 1 & 2 established the multi-tenant patterns: per-user encrypted keys in D1, `hydrateEnv(env, chatId)` overlay, fan-out via self-fetch. This change applies those patterns to the webhook pipeline.

## Goals / Non-Goals

**Goals:**
- Each repo gets its own auto-generated webhook secret
- Incoming webhooks are verified per-repo, identifying the owning user
- Content generation and GitHub API calls use the repo owner's keys
- Notifications go to the repo owner's Telegram chat
- Remove shared `GITHUB_WEBHOOK_SECRET` and `GITHUB_OWNER` from Worker secrets

**Non-Goals:**
- Webhook deduplication (same repo watched by multiple users = separate webhooks, each fires independently)
- Admin dashboard for webhook health monitoring
- Retry/replay of failed webhook deliveries
- Migrating existing webhooks automatically (users re-watch to get new per-user webhooks)

## Decisions

### 1. Per-repo secret generation and storage

**Decision**: Generate a random secret per repo using `crypto.randomUUID()`, store it in a new `webhook_secret` column on the `repos` table.

**Rationale**: Simple, no shared state, each webhook is independently verifiable. `crypto.randomUUID()` provides sufficient entropy for HMAC signing secrets. Alternative considered: deriving secrets from a master key + repo ID — adds complexity for no real benefit.

### 2. Webhook verification by repo lookup

**Decision**: On incoming webhook, parse `owner/repo` from the payload first (before signature verification), query `SELECT * FROM repos WHERE owner = ? AND repo = ?` to get all matching rows, then try `verifyWebhookSignature(row.webhook_secret, payload, signature)` for each row until one succeeds.

**Rationale**: GitHub sends `repository.full_name` in the payload body. We can read it before verification since we're not trusting it for auth — we're using it as a lookup key to find candidate secrets, then the HMAC verification is the actual auth. If multiple users watch the same repo, each has a different secret; we try each one. In practice this is 1-2 rows max.

Alternative considered: Include user identifier in the webhook URL path (e.g., `/github-webhook/{chatId}`). Rejected — leaks user IDs in URLs and requires URL-based routing.

### 3. Env hydration before processing

**Decision**: After identifying the repo owner via signature verification, call `hydrateEnv(env, chatId)` and pass the hydrated env to all downstream functions (`getPR`, `generateContent`, `sendMessage`).

**Rationale**: Follows the exact same pattern established in Phase 2 for cron fan-out. The hydrated env overlays the user's decrypted keys (GITHUB_TOKEN, GEMINI_API_KEY, etc.) onto the base env.

### 4. Notification target fix

**Decision**: Change `sendNotification` to accept and use `chatId` parameter instead of reading `env.TELEGRAM_CHAT_ID`.

**Rationale**: Direct fix. The `chatId` is already extracted from the repo row at line 61 of `github-webhook.ts`. It just needs to be threaded through to the notification function.

### 5. Worker URL from env

**Decision**: Replace the hardcoded URL `'https://content-bot.keisarcontentcreator.workers.dev'` in `add-repo.ts` with `env.WORKER_URL`.

**Rationale**: `WORKER_URL` was added to the Env type in Phase 2. Simple fix.

## Risks / Trade-offs

**[Multiple HMAC checks per webhook]** → At most N checks where N = number of users watching the same repo. In practice 1-2. HMAC-SHA256 is fast (~microseconds). Acceptable.

**[Existing webhooks break]** → Webhooks created before this change used the shared secret. After deploy, they'll fail verification because the repo rows won't have `webhook_secret` populated. **Mitigation**: Users re-watch repos (delete + add) to create new webhooks with per-repo secrets. Document in deploy notes.

**[User without GitHub token]** → If a user's GITHUB_TOKEN is missing/expired, `hydrateEnv` returns `undefined` for it. `getPR` and `generateContent` will fail. **Mitigation**: The webhook handler already catches errors per-event and sends error notifications. The user gets told their key is invalid.

## Migration Plan

1. Add `webhook_secret TEXT` column to `repos` table (nullable, existing rows get NULL)
2. Deploy code changes
3. Remove `GITHUB_WEBHOOK_SECRET` and `GITHUB_OWNER` from wrangler secret config
4. Users with existing repos: unwatch + re-watch to regenerate webhooks with per-repo secrets
5. Webhooks with NULL `webhook_secret` will fail verification (old webhooks) — this is expected and self-healing when users re-watch
