## 1. Database & Types Foundation

- [x] 1.1 Create `migrations/004_users.sql`: CREATE TABLE `users` with all columns (identity, encrypted keys, feature flags, UI state, settings, rate limiting, timestamps)
- [x] 1.2 Add migration logic to copy `chat_state` data (message_id, current_view, context, timezone, page_size, video_settings) into `users` row for existing admin, then DROP TABLE `chat_state`
- [x] 1.3 Update `types.ts`: add `ENCRYPTION_KEY` and `MAX_USERS` to `Env` interface, add `User` type matching `users` table columns
- [x] 1.4 Update `schema.sql` to reflect the new `users` table and remove `chat_state` definition

## 2. Encryption Service

- [x] 2.1 Create `services/crypto.ts` with `encrypt(env, plaintext)` and `decrypt(env, encryptedBlob)` functions using AES-256-GCM via `crypto.subtle`
- [x] 2.2 Set `ENCRYPTION_KEY` Worker secret via `wrangler secret put` (32-byte, base64-encoded)

## 3. User Database Service

- [x] 3.1 Create `services/user-db.ts` with CRUD functions: `getUser(env, chatId)`, `createUser(env, chatId, username, displayName)`, `updateUser(env, chatId, updates)`, `getUserCount(env)`
- [x] 3.2 Add key storage functions: `storeEncryptedKey(env, chatId, keyField, encryptedValue)`, `getUserEncryptedKeys(env, chatId)`

## 4. Migrate chat_state Functions in db.ts

- [x] 4.1 Update `getChatState(env, chatId)` to SELECT from `users` table instead of `chat_state`
- [x] 4.2 Update `updateChatState(env, chatId, updates)` to UPDATE `users` table instead of `chat_state`
- [x] 4.3 Update `getTimezone(env, chatId)` to read from `users` table
- [x] 4.4 Update `setTimezone(env, chatId, tz)` to write to `users` table
- [x] 4.5 Update `getPageSize(env, chatId)` to read from `users` table
- [x] 4.6 Update `setPageSize(env, chatId, size)` to write to `users` table
- [x] 4.7 Update `getVideoSettings(env, chatId)` to read from `users` table
- [x] 4.8 Update `updateVideoSettings(env, chatId, settings)` to write to `users` table

## 5. Security Model

- [x] 5.1 Add `isAdmin(chatId, env)` function to `services/security.ts` — returns `String(chatId) === env.TELEGRAM_CHAT_ID`
- [x] 5.2 Replace `isAuthorizedUser(userId, env)` in `services/security.ts` with new logic: query `users` table, return true only if `status = 'active'`
- [x] 5.3 Update `routes/webhook.ts` to use new auth flow: unregistered → onboarding, onboarding → resume onboarding, active → proceed, suspended → reject

## 6. User Key Resolution & Env Hydration

- [x] 6.1 Create `services/user-keys.ts` with `getUserKeys(env, chatId)` — reads user's encrypted keys from D1, decrypts them, returns object matching Env API key fields
- [x] 6.2 Add env hydration in `routes/webhook.ts`: after auth, call `getUserKeys`, spread result over `env`, pass hydrated env to handlers
- [x] 6.3 Verify that existing services (`gemini.ts`, `x.ts`, `github.ts`, `heygen.ts`) work unchanged with hydrated env

## 7. Onboarding Flow

- [x] 7.1 Create `views/onboarding.ts` with render functions: welcome screen, Gemini key prompt, X keys prompt, GitHub token prompt, completion summary
- [x] 7.2 Create `commands/onboarding.ts` — handles `/start` for unregistered users, creates user row, shows welcome screen
- [x] 7.3 Create `inputs/onboarding-key.ts` — handles free-text key input during onboarding: parse, encrypt, store, delete Telegram message, validate with test API call, advance step
- [x] 7.4 Implement Gemini key validation: test `generateContent` call with minimal prompt
- [x] 7.5 Implement X keys validation: parse 4-line message, test `verifyCredentials()` call
- [x] 7.6 Implement GitHub token validation: test `GET /user` call
- [x] 7.7 Implement max users cap check: query `getUserCount(env)` against `env.MAX_USERS` during user creation
- [x] 7.8 Register onboarding command and input handlers in `core/router.ts`

## 8. Settings Restructure

- [x] 8.1 Update `views/settings.ts`: remove video settings button (`vsettings:home`), add API Keys section showing connected/disconnected status per service
- [x] 8.2 Create key update/connect input handler: when user clicks Update or Connect in settings, prompt for key, encrypt, store, validate, refresh settings view
- [x] 8.3 Register new settings callbacks in `core/router.ts` for key management actions

## 9. Video Studio Admin Restriction

- [x] 9.1 Update home view to conditionally render Video Studio button only when `isAdmin(chatId, env)` is true
- [x] 9.2 Add `isAdmin` safety check in `actions/view-change.ts` for `view:video_studio` — return "not available" for non-admin
- [x] 9.3 Add Video Settings button to `views/video-studio.ts` home screen (moved from general settings)

## 10. Cron Notification Fix

- [x] 10.1 Update `handlers/cron.ts` `publishScheduledDrafts`: use `draft.chat_id` instead of `env.TELEGRAM_CHAT_ID` for success/failure notifications
- [x] 10.2 Update `handlers/cron.ts` `checkStaleVideoGenerations`: use `video_draft.chat_id` for stale alert notifications
- [x] 10.3 Update `handlers/cron.ts` `publishScheduledVideos`: use `video_draft.chat_id` for publish notifications

## 11. Migration & Deploy

- [ ] 11.1 Run migration via `/migrate` endpoint to create `users` table and migrate `chat_state` data
- [ ] 11.2 Deploy updated Worker code
- [ ] 11.3 Admin completes onboarding flow (`/start`) to store encrypted keys
- [ ] 11.4 Verify all manual features work with admin's D1-stored keys (repost, handwrite, drafts, generate, accounts, settings)
- [ ] 11.5 Verify a second test user can register and use features with their own keys
