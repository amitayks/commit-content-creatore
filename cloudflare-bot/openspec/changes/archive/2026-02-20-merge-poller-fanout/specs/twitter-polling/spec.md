## ADDED Requirements

### Requirement: Poller services merged into content-bot
All twitter-poller services (poller, scoring, batch-notification, auto-approve, x-read, db functions) SHALL be merged into the content-bot Worker. The twitter-poller project SHALL be deleted after merge.

#### Scenario: Poller code lives in content-bot
- **WHEN** the merge is complete
- **THEN** all polling, scoring, notification, and auto-approve logic SHALL exist under `cloudflare-bot/src/services/`
- **AND** the `twitter-poller/` project directory SHALL be deleted

### Requirement: OAuth helpers deduplicated
The OAuth 1.0a helpers (`hmacSha1`, `percentEncode`, `generateOAuthHeader`) SHALL exist only in `services/x.ts`. The twitter-poller's `x-read.ts` read functions (getUserTweets, lookupUserByUsername, searchConversation) SHALL be merged into `services/x.ts`.

#### Scenario: Single OAuth implementation
- **WHEN** any service needs to make an authenticated X API call (read or write)
- **THEN** it SHALL import OAuth helpers from `services/x.ts`
- **AND** no duplicate OAuth code SHALL exist elsewhere

### Requirement: Telegram helpers deduplicated
The poller services SHALL use the existing `services/telegram.ts` from content-bot. The twitter-poller's `telegram.ts` (72 LOC minimal copy) SHALL be deleted.

#### Scenario: Batch notification uses content-bot telegram service
- **WHEN** `batch-notification.ts` sends a Telegram message
- **THEN** it SHALL import `sendMessage` and `editMessage` from `../services/telegram`

### Requirement: Repost generation uses content-bot version
The content-bot's `services/repost-generate.ts` (which has the `personaOverride` parameter) SHALL be the single implementation. The twitter-poller's simplified version SHALL be deleted.

#### Scenario: Auto-approve uses existing repost-generate
- **WHEN** `auto-approve.ts` generates repost content
- **THEN** it SHALL import `generateRepostContent` from `../services/repost-generate`
- **AND** pass `undefined` for the `personaOverride` parameter

### Requirement: Poller DB queries scoped by chat_id
All poller database queries SHALL accept a `chatId` parameter and filter by `chat_id`. No poller query SHALL operate globally across all users.

#### Scenario: getWatchingTwitterAccounts scoped
- **WHEN** `getWatchingTwitterAccounts(env, chatId)` is called
- **THEN** it SHALL return only accounts where `chat_id = chatId AND is_watching = 1`

#### Scenario: Scoring scoped to user's tweets
- **WHEN** the scoring pipeline runs for a user
- **THEN** it SHALL only score tweets belonging to that user's watched accounts

### Requirement: Types deduplicated
All Twitter-related types (TwitterAccount, TwitterAccountConfig, TwitterTweet, TwitterTweetStatus, ThreadBufferEntry, etc.) already exist in content-bot's `types.ts`. The twitter-poller's `types.ts` SHALL be deleted. Merged services SHALL import from the content-bot types.

#### Scenario: Single type source
- **WHEN** any merged poller service needs a Twitter type
- **THEN** it SHALL import from `../types`
- **AND** the type SHALL be the one defined in `cloudflare-bot/src/types.ts`

### Requirement: Poller-only services preserved
Services unique to the poller pipeline — `poller.ts`, `scoring.ts`, `scoring-prompt.ts`, `batch-notification.ts`, `auto-approve.ts` — SHALL be moved into `cloudflare-bot/src/services/` with import paths updated and multi-tenant scoping added.

#### Scenario: Poller services accessible from content-bot
- **WHEN** the unified cron handler needs to poll a user's accounts
- **THEN** it SHALL import `pollUserAccounts` from `../services/poller`

### Requirement: Poller-specific DB functions merged
The twitter-poller's `db.ts` functions (getWatchingTwitterAccounts, createTwitterTweet, updateTwitterTweet, getPendingTweetsByAccount, getRecentTweetsByAccount, getScoredTweetsByBatchMessage, createDraft for auto-approve, updateTwitterAccount, getTwitterAccountOverview, parseTwitterAccountConfig) SHALL be merged into content-bot's `services/db.ts`.

#### Scenario: DB functions available in content-bot
- **WHEN** merged poller services call DB functions
- **THEN** all needed functions SHALL be importable from `../services/db`
- **AND** functions that already exist in content-bot's db.ts SHALL NOT be duplicated
