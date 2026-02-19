## Context

Muse is a single-tenant Telegram bot running on Cloudflare Workers. One user is authorized via `env.TELEGRAM_CHAT_ID`, and all API keys (X, Gemini, GitHub, HeyGen) are stored as Worker secrets. The `chat_state` table holds per-user UI state and settings.

Phase 1 transforms Muse into a multi-tenant service where multiple users share one bot, one Worker, and one D1 database. Each user brings their own API keys via Telegram chat. Keys are encrypted at rest in D1. This phase covers manual actions only — cron fan-out and GitHub webhook fan-out are deferred.

Key constraint: minimize changes to existing service files. The middleware injection pattern achieves this by hydrating `env` with per-user keys at the entry point, so downstream code is untouched.

## Goals / Non-Goals

**Goals:**
- Multiple users can register, provide their own API keys, and use all manual bot features (/repost, /handwrite, /drafts, /generate, /accounts)
- User API keys encrypted at rest with AES-256-GCM
- Key messages deleted from Telegram chat immediately after capture
- Admin retains access to Video Studio; regular users cannot reach it
- Settings screen restructured: API Keys section added, video settings moved to Video Studio
- `chat_state` table merged into `users` table (one row per user)
- Zero changes to service files (gemini.ts, x.ts, github.ts, heygen.ts, etc.)

**Non-Goals:**
- Cron fan-out (Phase 2)
- Worker merging — twitter-poller stays separate (Phase 2)
- GitHub webhook fan-out / repos UNIQUE constraint fix (Phase 3)
- Video Studio multi-tenant (Phase 4)
- Admin dashboard UI
- Rate limiting enforcement (table columns added but enforcement deferred)

## Decisions

### 1. Merge `chat_state` into `users` table

**Decision:** Single `users` table holds identity, encrypted keys, UI state, and settings. `chat_state` is dropped.

**Rationale:** Two per-user tables means two queries per request and two tables to maintain. All `chat_state` access is funneled through 8 functions in `db.ts` — the merge only requires updating those 8 functions to reference `users`.

**Alternative considered:** Keep tables separate. Rejected because it adds unnecessary complexity with multiple users, and the separation of concerns (identity vs. preferences) doesn't justify the overhead.

### 2. Middleware injection for per-user keys (Approach B)

**Decision:** At the webhook entry point, resolve user's keys from D1, decrypt them, and spread over `env`. Pass this hydrated `env` downstream. Service files are unchanged.

```
webhook arrives → getUserKeys(env, chatId) → { ...env, ...userKeys } → handler(hydratedEnv, ...)
```

**Rationale:** Approach A (change every function signature) touches 20+ files. Approach B touches 1-2 entry points. The `Env` type stays the same — the values just come from D1 instead of Worker secrets.

**Alternative considered:** Approach A — explicit `UserEnv` parameter on every service function. Rejected due to massive blast radius.

### 3. No admin fallback — everyone onboards

**Decision:** No user (including admin) falls back to Worker secrets for API keys. Everyone goes through the onboarding flow. If a user has no encrypted keys, they get an error.

**Rationale:** One code path for all users. No special cases. Simpler `getUserKeys()`. After admin onboards, per-user API key Worker secrets can be removed.

**Alternative considered:** Admin falls back to `env` secrets. Rejected because it creates a special code path that could mask bugs, and the user explicitly preferred no fallback.

### 4. Video Studio access: hide button, no router wrapper

**Decision:** The Video Studio button in the home view is conditionally rendered only for admin (`isAdmin(chatId, env)`). No `adminOnly` wrapper in the router. A safety-net `isAdmin` check on the `view:video_studio` handler catches edge cases.

**Rationale:** No `/video` slash command exists, so hiding the button removes all entry points. A router wrapper would add abstraction for a problem that's already solved by not rendering the button. The safety-net check costs nothing and prevents crafted callback queries.

**Alternative considered:** `adminOnly()` wrapper on all video callback handlers in router.ts. Rejected as over-engineering — there's no entry path without the button.

### 5. Video settings moved into Video Studio

**Decision:** `views/settings.ts` no longer shows the video settings button. Instead, `views/video-studio.ts` home screen shows a "Video Settings" button. This keeps video configuration colocated with video features and naturally scoped to admin.

### 6. Encryption with `crypto.subtle` (Web Crypto API)

**Decision:** AES-256-GCM via `crypto.subtle`, which is built into Cloudflare Workers. Single `ENCRYPTION_KEY` Worker secret (32 bytes, base64-encoded). Each encryption generates a random 12-byte IV. Storage format: `base64(IV + ciphertext + authTag)`.

**Rationale:** Zero dependencies. ~1ms CPU per encrypt/decrypt. Well-tested primitive available natively. GCM provides both confidentiality and integrity.

### 7. Onboarding as a state machine in `users.onboarding_step`

**Decision:** The `onboarding_step` column tracks which step the user is on (`welcome`, `gemini_key`, `x_keys`, `github_token`, `complete`). The message handler checks this before routing to normal command/input handlers.

**Rationale:** Simple, persisted across requests, no in-memory state. If a user disappears mid-onboarding and comes back, they resume where they left off.

### 8. `isAdmin` vs `isAuthorized` separation

**Decision:** Two distinct functions:
- `isAdmin(chatId, env)`: `String(chatId) === env.TELEGRAM_CHAT_ID` — simple string check, no DB
- `isAuthorized(chatId, env)`: DB lookup for `users` row with `status = 'active'`

**Rationale:** Admin check is used for Video Studio access and admin endpoints. It must work without DB access (in case the user hasn't onboarded yet). Auth check is for all other features and must verify the user completed onboarding.

## Risks / Trade-offs

**[Risk] Onboarding flow interrupts admin on first deploy** → The admin must complete onboarding before they can use the bot normally. Mitigation: onboarding is quick (3 steps), and the admin already has their keys ready.

**[Risk] Key message not deleted if Worker crashes mid-processing** → The Telegram `deleteMessage` call could fail. Mitigation: attempt deletion as early as possible, before key validation. Log failures. User can manually delete.

**[Risk] `ENCRYPTION_KEY` loss = all user keys lost** → Single master key. Mitigation: document that this key must be backed up. It's set once via `wrangler secret put` and doesn't change.

**[Risk] D1 query per request for user lookup** → Every webhook request now does a D1 read for user + key decryption. Mitigation: D1 reads are ~5ms and don't count as CPU time. At 50 users this is negligible.

**[Risk] `chat_state` → `users` migration data loss** → If migration SQL is wrong, admin loses UI state. Mitigation: migration copies data before dropping `chat_state`. Can verify with `SELECT *` before `DROP`.

## Migration Plan

1. Deploy `migrations/004_users.sql`: creates `users` table, copies `chat_state` data for admin, drops `chat_state`
2. Deploy updated code (new security model, onboarding, env hydration)
3. Admin sends `/start` to the bot, completes onboarding (provides keys)
4. Admin verifies all features work with their new D1-stored keys
5. Remove per-user API key Worker secrets (keep `ENCRYPTION_KEY`, `TELEGRAM_BOT_TOKEN`, `ADMIN_SECRET`, `GITHUB_WEBHOOK_SECRET`)

**Rollback:** Re-deploy previous code version. Manually recreate `chat_state` table and copy data back from `users`. Re-add Worker secrets.

## Open Questions

None — all questions resolved during brainstorming.
