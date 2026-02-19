## 1. DB Schema

- [x] 1.1 Add `webhook_secret TEXT` column to `repos` table in `schema.sql`
- [x] 1.2 Add migration in `routes/migrate.ts` to `ALTER TABLE repos ADD COLUMN webhook_secret TEXT`

## 2. Webhook Creation (per-repo secret)

- [x] 2.1 Update `createWebhook` in `services/webhook.ts` to accept a `secret` parameter instead of reading `env.GITHUB_WEBHOOK_SECRET`
- [x] 2.2 Update `add-repo.ts`: generate random secret via `crypto.randomUUID()`, pass it to `createWebhook`, store in `repos.webhook_secret` via `updateRepo`. Use `env.WORKER_URL` instead of hardcoded URL.
- [x] 2.3 Add `webhook_secret` to the `updateRepo` / `createRepo` DB functions if not already supported

## 3. Webhook Verification (per-repo lookup)

- [x] 3.1 Create `getAllReposByOwnerRepo(env, owner, repo)` DB function — returns all repo rows matching owner/repo (not just first match)
- [x] 3.2 Rewrite `handleGitHubWebhook` signature verification: parse owner/repo from payload, fetch all matching repos, try `verifyWebhookSignature` with each row's `webhook_secret` (skip NULL secrets), return the matching repo row
- [x] 3.3 After match found, call `hydrateEnv(env, chatId)` and use hydrated env for all downstream calls (`getPR`, `generateContent`)

## 4. Fix Notification Target

- [x] 4.1 Change `sendNotification` in `github-webhook.ts` to accept `chatId` parameter and send to it instead of `env.TELEGRAM_CHAT_ID`
- [x] 4.2 Thread `chatId` through `handlePullRequestEvent` and `handlePushEvent` to `sendNotification`

## 5. Remove Shared Secrets from Env

- [x] 5.1 Make `GITHUB_WEBHOOK_SECRET` and `GITHUB_OWNER` optional in `types.ts` Env interface (change from required to `?:`)
- [x] 5.2 Update `findCommitBysha` in `services/github.ts` to accept owner as parameter instead of reading `env.GITHUB_OWNER` (or remove if not used in webhook flow)
- [x] 5.3 Update `wrangler.toml` secrets documentation to remove `GITHUB_WEBHOOK_SECRET` and `GITHUB_OWNER` from required secrets

## 6. Cleanup & Verification

- [x] 6.1 Verify build: `npx wrangler deploy --dry-run`
- [x] 6.2 Verify: no remaining hardcoded references to shared webhook secret or hardcoded worker URL
- [x] 6.3 Verify: `deleteWebhook` in `repo-actions.ts` still works (uses user's hydrated env for GitHub API call)
