## MODIFIED Requirements

### Requirement: Environment Secret Management
All shared infrastructure keys/tokens SHALL be stored as Cloudflare secrets: `TELEGRAM_BOT_TOKEN`, `ENCRYPTION_KEY`, `ADMIN_SECRET`, `GITHUB_WEBHOOK_SECRET`, `TELEGRAM_CHAT_ID`. Per-user API keys (`GOOGLE_API_KEY`, `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`, `GITHUB_TOKEN`, `HEYGEN_API_KEY`) SHALL be stored encrypted in D1 `users` table and resolved per-request via env hydration. The `Env` interface SHALL include `ENCRYPTION_KEY: string` and `MAX_USERS?: string`.

#### Scenario: Per-user keys not in Worker secrets
- **WHEN** the Worker is deployed
- **THEN** per-user API keys are NOT stored as Worker secrets — they exist only in D1 encrypted

#### Scenario: ENCRYPTION_KEY in Worker secrets
- **WHEN** the Worker starts
- **THEN** `env.ENCRYPTION_KEY` is available as a Worker secret for encrypting/decrypting user keys

## ADDED Requirements

### Requirement: users table replaces chat_state
The D1 database SHALL have a `users` table that combines user identity, encrypted keys, UI state, and settings. The `chat_state` table SHALL be dropped after data migration.

#### Scenario: users table exists after migration
- **WHEN** the migration runs
- **THEN** the `users` table exists with columns for identity, encrypted keys, feature flags, UI state, settings, rate limiting, and timestamps

#### Scenario: chat_state data preserved
- **WHEN** the migration runs and an existing `chat_state` row exists
- **THEN** the UI state and settings data (message_id, current_view, context, timezone, page_size, video_settings) is copied to the corresponding `users` row
