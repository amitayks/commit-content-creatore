## Why

The GitHub webhook pipeline is the last piece still running as single-tenant. When a webhook arrives, it verifies against a shared `GITHUB_WEBHOOK_SECRET`, processes the event using the admin's GitHub token and Gemini key, and sends the notification to the admin's Telegram chat. This means non-admin users who add repos get webhooks created with the admin's secret and all content generation uses admin credentials. Phase 3 of the multi-tenant plan fixes this so each user's webhooks are fully isolated.

## What Changes

- **Per-repo webhook secret**: Auto-generate a unique secret per repo when creating a webhook. Store it in the `repos` table. Stop using the shared `GITHUB_WEBHOOK_SECRET` Worker secret.
- **Signature verification by repo lookup**: On incoming webhook, look up matching repos by `owner/repo`, verify the signature against each repo's stored secret to identify which user's webhook fired.
- **Hydrate env before processing**: Call `hydrateEnv(env, chatId)` so that `generateContent`, `getPR`, and all downstream calls use the repo owner's GitHub token and Gemini API key instead of the admin's.
- **Fix notification target**: `sendNotification` currently sends to `env.TELEGRAM_CHAT_ID` (admin). Change to send to the repo owner's `chatId`.
- **Use `env.WORKER_URL`** instead of hardcoded worker URL when creating webhooks.
- **BREAKING**: Remove `GITHUB_WEBHOOK_SECRET` and `GITHUB_OWNER` from required Worker secrets. They become unnecessary.

## Capabilities

### New Capabilities
- `per-user-webhook`: Per-repo webhook secret generation, storage, and verification. Covers the full lifecycle: create with unique secret, verify incoming by repo lookup, delete on unwatch.

### Modified Capabilities
_(no existing specs to modify)_

## Impact

- **DB schema**: Add `webhook_secret` column to `repos` table (migration required)
- **Files modified**: `services/webhook.ts`, `handlers/github-webhook.ts`, `inputs/add-repo.ts`, `services/github.ts` (remove `GITHUB_OWNER` usage), `types.ts` (remove `GITHUB_WEBHOOK_SECRET` / `GITHUB_OWNER` from Env)
- **Secrets**: `GITHUB_WEBHOOK_SECRET` and `GITHUB_OWNER` can be removed from Worker secrets after deploy
- **Existing webhooks**: Any webhooks created before this change used the old shared secret and will fail verification. They need to be re-created (delete + re-watch).
