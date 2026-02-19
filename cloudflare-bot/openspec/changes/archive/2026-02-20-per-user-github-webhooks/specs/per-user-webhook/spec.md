## ADDED Requirements

### Requirement: Per-repo webhook secret generation
When a user adds a repo to watch, the system SHALL generate a unique random secret for that repo and store it in the `repos.webhook_secret` column. The system SHALL use this per-repo secret (not a shared Worker secret) when creating the GitHub webhook via the API.

#### Scenario: User watches a new repo
- **WHEN** a user adds `owner/repo` via the /watch flow
- **THEN** the system generates a random secret, stores it in `repos.webhook_secret`, and creates the GitHub webhook using that secret as the HMAC signing key

#### Scenario: Webhook URL uses env.WORKER_URL
- **WHEN** the system creates a GitHub webhook
- **THEN** it SHALL use `env.WORKER_URL` as the base URL (not a hardcoded URL)

### Requirement: Per-repo webhook signature verification
When a GitHub webhook arrives, the system SHALL look up all `repos` rows matching the payload's `owner/repo`, then verify the signature against each row's `webhook_secret` until a match is found. The matching row identifies the owning user.

#### Scenario: Single user watches repo
- **WHEN** a webhook arrives for `owner/repo` and exactly one user watches that repo
- **THEN** the system verifies the signature against that repo row's `webhook_secret` and processes the event for that user

#### Scenario: Multiple users watch same repo
- **WHEN** a webhook arrives for `owner/repo` and multiple users watch that repo
- **THEN** the system tries each row's `webhook_secret` until one verifies, and processes the event for the matching user only

#### Scenario: No matching secret
- **WHEN** a webhook arrives but no repo row's `webhook_secret` produces a valid signature
- **THEN** the system SHALL reject the webhook with "Invalid signature"

#### Scenario: Repo row has NULL webhook_secret (legacy)
- **WHEN** a webhook arrives and a matching repo row has `webhook_secret = NULL`
- **THEN** that row SHALL be skipped during verification (not crash)

### Requirement: Hydrated env for webhook processing
After identifying the repo owner via signature verification, the system SHALL call `hydrateEnv(env, chatId)` and use the hydrated env for all downstream processing (GitHub API calls, content generation, notifications).

#### Scenario: Content generation uses user's API keys
- **WHEN** a webhook is processed for a user's repo
- **THEN** `generateContent` and `getPR` SHALL be called with the hydrated env containing the user's GEMINI_API_KEY and GITHUB_TOKEN

#### Scenario: User's GitHub token is missing
- **WHEN** `hydrateEnv` returns an env with undefined GITHUB_TOKEN
- **THEN** the webhook processing SHALL fail gracefully and the error is logged

### Requirement: Notification sent to repo owner
The system SHALL send webhook-triggered notifications (new draft created, errors) to the repo owner's `chatId`, not to `env.TELEGRAM_CHAT_ID`.

#### Scenario: Draft created notification
- **WHEN** a webhook generates a new draft for user with chatId X
- **THEN** the Telegram notification SHALL be sent to chatId X

### Requirement: Webhook cleanup on unwatch
When a user removes a repo from their watch list, the system SHALL delete the GitHub webhook using the stored `webhook_id` and the user's GitHub token.

#### Scenario: User unwatches a repo
- **WHEN** a user removes a repo via the unwatch flow
- **THEN** the system deletes the webhook from GitHub using `DELETE /repos/{owner}/{repo}/hooks/{webhook_id}` with the user's GITHUB_TOKEN

### Requirement: Remove shared webhook secrets from Worker config
The system SHALL NOT require `GITHUB_WEBHOOK_SECRET` or `GITHUB_OWNER` as Worker-level secrets. These are replaced by per-user/per-repo values.

#### Scenario: Worker starts without GITHUB_WEBHOOK_SECRET
- **WHEN** the Worker starts without `GITHUB_WEBHOOK_SECRET` set
- **THEN** the system SHALL function normally (no startup errors or missing-env failures)
