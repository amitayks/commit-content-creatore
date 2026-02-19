## ADDED Requirements

### Requirement: Unified cron schedule
The system SHALL use a single cron schedule `*/15 * * * *` (every 15 minutes) for all periodic work, replacing both the hourly content-bot cron and the 15-minute twitter-poller cron.

#### Scenario: Cron triggers every 15 minutes
- **WHEN** the Cloudflare cron fires at the `*/15 * * * *` schedule
- **THEN** the system SHALL invoke the coordinator function to determine which users have pending work

### Requirement: Smart coordinator query
The coordinator SHALL query D1 for active users who have at least one of: watching Twitter accounts, due scheduled drafts, stale video generations (>30 min), or due scheduled videos. Users with no pending work SHALL NOT receive a fan-out request.

#### Scenario: Users with watching accounts
- **WHEN** user A has `twitter_accounts` rows with `is_watching = 1` and `chat_id = A`
- **THEN** user A SHALL be included in the fan-out dispatch

#### Scenario: Users with due drafts
- **WHEN** user B has `drafts` rows with `status = 'scheduled'` and `scheduled_at <= NOW()`
- **THEN** user B SHALL be included in the fan-out dispatch

#### Scenario: Users with stale video generations
- **WHEN** user C has `video_drafts` rows with `status = 'generating'` and `updated_at <= 30 minutes ago`
- **THEN** user C SHALL be included in the fan-out dispatch

#### Scenario: Users with scheduled videos
- **WHEN** user D has `video_drafts` rows with `status = 'scheduled'` and `scheduled_at <= NOW()`
- **THEN** user D SHALL be included in the fan-out dispatch

#### Scenario: Idle users skipped
- **WHEN** user E has no watching accounts, no due drafts, no stale videos, and no scheduled videos
- **THEN** user E SHALL NOT receive a fan-out request

### Requirement: Per-user fan-out via internal endpoint
The coordinator SHALL dispatch one HTTP request per qualifying user to `POST /internal/user-cron` on the Worker's own URL. Each request runs in a separate Cloudflare isolate with its own CPU budget.

#### Scenario: Fan-out dispatches parallel requests
- **WHEN** the coordinator finds 3 users with pending work
- **THEN** 3 independent `POST /internal/user-cron` requests SHALL be dispatched
- **AND** all requests SHALL run in parallel (not sequentially)

#### Scenario: One user failure does not affect others
- **WHEN** user A's fan-out request fails (key hydration error, API timeout, etc.)
- **THEN** user B and C's fan-out requests SHALL continue unaffected

### Requirement: Internal endpoint authentication
The `/internal/user-cron` endpoint SHALL require `Authorization: Bearer {ADMIN_SECRET}` header. Requests without valid auth SHALL be rejected with 401.

#### Scenario: Valid auth accepted
- **WHEN** a request to `/internal/user-cron` includes `Authorization: Bearer {ADMIN_SECRET}` matching the Worker's ADMIN_SECRET env var
- **THEN** the request SHALL be processed

#### Scenario: Missing or invalid auth rejected
- **WHEN** a request to `/internal/user-cron` lacks the Authorization header or provides an incorrect secret
- **THEN** the system SHALL respond with HTTP 401 and not execute any work

### Requirement: Per-user work execution
Each `/internal/user-cron` invocation SHALL hydrate the env with the specified user's decrypted API keys and then execute all applicable cron tasks for that user: poll Twitter accounts, publish due drafts, check stale videos, publish scheduled videos.

#### Scenario: Full per-user cron cycle
- **WHEN** `/internal/user-cron` is called with `chatId=123`
- **THEN** the system SHALL call `hydrateEnv(env, "123")`
- **AND** execute pollUserAccounts, publishUserDrafts, checkUserStaleVideos, publishUserScheduledVideos in sequence for that user

#### Scenario: Key hydration failure
- **WHEN** `hydrateEnv` fails for a user (missing or corrupt keys)
- **THEN** the system SHALL log the error and return an error response
- **AND** SHALL NOT execute any cron tasks for that user

### Requirement: Worker self-URL configuration
The system SHALL use a `WORKER_URL` env var to construct fan-out request URLs. This allows the Worker to call itself for fan-out.

#### Scenario: Self-fetch uses WORKER_URL
- **WHEN** the coordinator dispatches a fan-out request
- **THEN** it SHALL construct the URL as `{WORKER_URL}/internal/user-cron`
