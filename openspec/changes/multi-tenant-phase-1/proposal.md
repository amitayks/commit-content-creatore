## Why

Muse is currently single-tenant: one user, one set of API keys hardcoded as Worker secrets. To let multiple users share the same bot and Worker deployment — each bringing their own API keys — we need multi-user auth, per-user encrypted key storage, an onboarding flow, and per-user env hydration. This is Phase 1: everything needed for manual actions (repost, handwrite, drafts, generate, accounts) to work multi-tenant. Cron fan-out and GitHub webhook fan-out are deferred to later phases.

## What Changes

- **New `users` table** that merges identity, encrypted keys, settings, and UI state (replaces `chat_state`)
- **AES-256-GCM encryption service** for storing user API keys securely in D1
- **Onboarding flow** — any new user (including admin) sends `/start`, provides Gemini + X keys (required), optionally GitHub/HeyGen keys, with key validation and immediate message deletion
- **Security model change** — authorization moves from single `env.TELEGRAM_CHAT_ID` check to `users` table lookup (`status = 'active'`). Unregistered users enter onboarding.
- **Per-user env hydration** — at webhook entry point, resolve user's decrypted keys and spread them over `env` so all downstream services work unchanged (middleware injection pattern)
- **Settings restructure** — remove video settings from general settings, add API Keys management section
- **Video Studio restricted to admin** — hide Video Studio button in home view for non-admin users; move video settings into Video Studio as a sub-section
- **Cron notification fix** — change hardcoded `env.TELEGRAM_CHAT_ID` notification targets to use each record's `chat_id`
- **No admin fallback** — admin goes through onboarding like everyone else, no fallback to Worker secrets

## Capabilities

### New Capabilities
- `key-encryption`: AES-256-GCM encrypt/decrypt service using `crypto.subtle` and a Worker secret (`ENCRYPTION_KEY`)
- `user-onboarding`: Step-by-step Telegram onboarding flow — welcome, Gemini key, X keys (4 values), optional GitHub token, completion screen. Key validation, message deletion, retry on failure.
- `multi-user-auth`: Authorization via `users` table lookup instead of single env check. `isAdmin()` helper for admin-only features. `isAuthorized()` checks user status in DB. Unregistered users redirected to onboarding.
- `user-key-resolution`: `getUserKeys(env, chatId)` decrypts user's keys from D1 and returns a hydrated env object. Applied at webhook entry point so all downstream services receive per-user keys transparently.

### Modified Capabilities
- `telegram-bot`: Authorization changes from single `TELEGRAM_CHAT_ID` check to multi-user `users` table lookup. Unregistered users enter onboarding instead of getting rejected.
- `user-settings`: Remove video settings button. Add API Keys management section (view connected keys, update/connect keys). Settings data now lives in `users` table instead of `chat_state`.
- `cloudflare-worker`: New `ENCRYPTION_KEY` Worker secret. `chat_state` table replaced by `users` table.
- `view-system`: Home view conditionally renders Video Studio button (admin only). Video Studio home gets a Video Settings button (moved from general settings).
- `schedule-timezone`: Timezone storage moves from `chat_state` to `users` table. No behavioral change — same column, different table.
- `publish-pipeline`: Cron notification targets change from `env.TELEGRAM_CHAT_ID` to `draft.chat_id` / `video_draft.chat_id`.
- `smart-dashboard`: Dashboard buttons conditionally show Video Studio (admin only).

## Impact

- **Database**: New `users` table, `chat_state` table dropped (data migrated). `repos` table UNIQUE constraint noted for future Phase 3 fix.
- **New files**: `services/crypto.ts`, `services/user-keys.ts`, `services/user-db.ts`, `commands/onboarding.ts`, `inputs/onboarding-key.ts`, `views/onboarding.ts`, `migrations/004_users.sql`
- **Modified files**: `types.ts`, `services/security.ts`, `services/db.ts` (8 functions change table name), `routes/webhook.ts`, `core/router.ts`, `views/settings.ts`, `views/home.ts`, `views/video-studio.ts`, `handlers/cron.ts`, `actions/view-change.ts`
- **Unchanged files**: All service files (`gemini.ts`, `x.ts`, `github.ts`, `heygen.ts`, `repost-generate.ts`, `persona-*.ts`) and all action/input handlers remain untouched thanks to middleware injection.
- **New Worker secret**: `ENCRYPTION_KEY` (32-byte random, base64-encoded)
- **Env type**: Add `ENCRYPTION_KEY` to `Env` interface. Per-user API key fields remain on `Env` type but are now hydrated per-request.
