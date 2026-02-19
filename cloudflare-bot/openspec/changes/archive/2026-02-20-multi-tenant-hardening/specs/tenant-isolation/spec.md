## ADDED Requirements

### Requirement: All user-scoped DB queries include chat_id filter
Every DB function that reads user-owned data (drafts, repos, tweets, video_drafts, published, twitter_accounts, twitter_tweets) SHALL include `chat_id` in the WHERE clause or verify ownership through a related table before returning results.

#### Scenario: getScoredTweetsByBatchMessage includes chat_id
- **WHEN** `getScoredTweetsByBatchMessage` is called with a batchMessageId and chatId
- **THEN** the query SHALL include `AND chat_id = ?` bound to the caller's chatId, preventing cross-tenant tweet access via message_id collision

#### Scenario: getRecentTweetsByAccount verifies account ownership
- **WHEN** `getRecentTweetsByAccount` is called with an accountId and chatId
- **THEN** the function SHALL verify that the account belongs to the chatId before returning tweets

#### Scenario: getTwitterAccountOverview verifies account ownership
- **WHEN** `getTwitterAccountOverview` is called with an accountId and chatId
- **THEN** the function SHALL verify that the account belongs to the chatId before returning the overview

#### Scenario: getTwitterTweet filters by chat_id at query level
- **WHEN** `getTwitterTweet` is called with a tweetId and chatId
- **THEN** the query SHALL include `AND chat_id = ?` so no post-fetch ownership check is needed

#### Scenario: getRepoOverview verifies repo ownership
- **WHEN** `getRepoOverview` is called with a repoId and chatId
- **THEN** the function SHALL verify that the repo belongs to the chatId before returning the overview

### Requirement: No hardcoded worker URLs
All URL construction SHALL use `env.WORKER_URL` instead of hardcoded domain strings. No source file SHALL contain literal worker domain URLs.

#### Scenario: Image URL construction uses env.WORKER_URL
- **WHEN** the system constructs an image URL for Telegram display
- **THEN** it SHALL use `${env.WORKER_URL}${imagePath}` not a hardcoded domain

#### Scenario: Video media URL construction uses env.WORKER_URL
- **WHEN** the system constructs a video/media URL for playback or publishing
- **THEN** it SHALL use `${env.WORKER_URL}/media/${key}` not a hardcoded domain

#### Scenario: HeyGen callback URL uses env.WORKER_URL
- **WHEN** the system registers a HeyGen callback URL
- **THEN** it SHALL use `${env.WORKER_URL}/heygen-webhook` not a hardcoded domain

### Requirement: isAdmin check does not use TELEGRAM_CHAT_ID fallback
The `isAdmin()` function SHALL use `env.ADMIN_CHAT_ID` exclusively. It SHALL NOT fall back to `env.TELEGRAM_CHAT_ID`, because after hydration that field contains the current user's chatId.

#### Scenario: isAdmin with hydrated env
- **WHEN** `isAdmin()` is called with a hydrated env where TELEGRAM_CHAT_ID is the user's chatId
- **THEN** it SHALL compare against ADMIN_CHAT_ID only, returning false if ADMIN_CHAT_ID is not set

### Requirement: External webhook queries may omit chat_id
DB functions used exclusively by external webhooks (HeyGen) that receive opaque IDs not controlled by users MAY omit chat_id filtering, but SHALL be clearly documented as intentionally unscoped.

#### Scenario: getVideoDraftByHeygenId is intentionally unscoped
- **WHEN** `getVideoDraftByHeygenId` is called from the HeyGen webhook handler
- **THEN** it SHALL query by `heygen_video_id` only (no chat_id), and the function SHALL have a doc comment explaining this is intentional
