## ADDED Requirements

### Requirement: getUserKeys resolves per-user decrypted keys
The system SHALL provide a `getUserKeys(env, chatId)` function that reads the user's encrypted keys from D1, decrypts them, and returns an object matching the shape of API key fields on `Env`.

#### Scenario: User has all keys
- **WHEN** `getUserKeys` is called for a user with all encrypted keys stored
- **THEN** it returns an object with `GOOGLE_API_KEY`, `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`, `GITHUB_TOKEN`, `HEYGEN_API_KEY` all decrypted

#### Scenario: User has partial keys
- **WHEN** `getUserKeys` is called for a user with only Gemini and X keys stored
- **THEN** it returns those keys decrypted, with `GITHUB_TOKEN` and `HEYGEN_API_KEY` as undefined

#### Scenario: User has no keys
- **WHEN** `getUserKeys` is called for a user with no encrypted keys in their row
- **THEN** the function throws an error indicating the user must complete onboarding

#### Scenario: User does not exist
- **WHEN** `getUserKeys` is called for a chat_id with no `users` row
- **THEN** the function throws an error

### Requirement: Env hydration at webhook entry point
The webhook handler SHALL call `getUserKeys` after authorization and spread the result over `env` to create a hydrated env object. This hydrated env is passed to all downstream handlers.

#### Scenario: Webhook request with registered user
- **WHEN** an authorized user's webhook request is processed
- **THEN** all downstream handlers receive an `env` where API key fields contain the user's decrypted keys

#### Scenario: Downstream service reads env.GOOGLE_API_KEY
- **WHEN** `gemini.ts` reads `env.GOOGLE_API_KEY` during a hydrated request
- **THEN** it receives the requesting user's decrypted Gemini key, not the Worker secret

### Requirement: Shared infra keys remain from original env
The hydrated env SHALL preserve shared infrastructure values from the original `env`: `DB`, `IMAGES`, `TELEGRAM_BOT_TOKEN`, `ENCRYPTION_KEY`, `ADMIN_SECRET`, `GITHUB_WEBHOOK_SECRET`.

#### Scenario: Shared bindings preserved
- **WHEN** env is hydrated with user keys
- **THEN** `env.DB`, `env.IMAGES`, and `env.TELEGRAM_BOT_TOKEN` remain the original Worker bindings

### Requirement: No fallback to Worker secrets
The `getUserKeys` function SHALL NEVER fall back to `env` Worker secrets if a user's encrypted keys are missing. It SHALL throw an error instead.

#### Scenario: Missing key does not fallback
- **WHEN** a user's `gemini_key_enc` is null and `getUserKeys` is called
- **THEN** the function does NOT return `env.GOOGLE_API_KEY` from Worker secrets — it returns undefined for that field or throws if the key is required
