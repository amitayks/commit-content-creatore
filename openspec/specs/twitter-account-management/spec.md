## ADDED Requirements

### Requirement: Twitter accounts table
The system SHALL store followed Twitter/X accounts in a `twitter_accounts` table with columns: `id` (TEXT PK), `chat_id` (TEXT NOT NULL), `username` (TEXT NOT NULL), `user_id` (TEXT — X numeric ID), `display_name` (TEXT), `is_watching` (INTEGER DEFAULT 1), `last_tweet_id` (TEXT — for since_id pagination), `config` (TEXT NOT NULL — JSON TwitterAccountConfig), `thread_buffer` (TEXT — JSON for incomplete thread tracking), `created_at`, `updated_at`. UNIQUE constraint on `(chat_id, username)`.

#### Scenario: Create new account
- **WHEN** a user adds @username to follow
- **THEN** a row is inserted with `is_watching=1`, `last_tweet_id=NULL`, and default config

#### Scenario: Prevent duplicate accounts
- **WHEN** a user tries to add an @username they already follow
- **THEN** the system SHALL reject with an error message

### Requirement: Twitter account overviews table
The system SHALL store AI-generated persona overviews in a `twitter_account_overviews` table with columns: `id` (TEXT PK), `account_id` (TEXT NOT NULL UNIQUE — FK to twitter_accounts), `persona` (TEXT), `topics` (TEXT — JSON array), `communication_style` (TEXT), `notable_context` (TEXT), `recent_themes` (TEXT — JSON array), `version` (INTEGER DEFAULT 1), `created_at`, `updated_at`.

#### Scenario: Bootstrap persona
- **WHEN** the user triggers "Bootstrap Overview" for an account
- **THEN** the system SHALL create or update the overview row with AI-generated persona data

### Requirement: Twitter tweets storage table
The system SHALL store all fetched tweets in a `twitter_tweets` table with columns: `id` (TEXT PK — tweet ID from X), `account_id` (TEXT NOT NULL), `chat_id` (TEXT NOT NULL), `conversation_id` (TEXT), `thread_position` (INTEGER DEFAULT 0), `is_thread` (INTEGER DEFAULT 0), `text` (TEXT NOT NULL), `author_username` (TEXT NOT NULL), `metrics` (TEXT — JSON), `tweet_url` (TEXT), `tweeted_at` (TEXT), `relevance_score` (INTEGER), `relevance_reason` (TEXT), `status` (TEXT DEFAULT 'pending'), `draft_id` (TEXT), `batch_message_id` (INTEGER), `created_at` (TEXT).

#### Scenario: Store fetched tweet
- **WHEN** a tweet is fetched from the X API
- **THEN** a row SHALL be inserted with `status='pending'`

#### Scenario: Tweet status lifecycle
- **WHEN** a tweet is processed through the pipeline
- **THEN** its status SHALL progress: `pending` → `buffered` (if thread) → `scored` → `drafted` or `skipped`

### Requirement: Drafts table additions for repost
The `drafts` table SHALL have two new columns: `original_tweet_id` (TEXT) and `original_tweet_url` (TEXT), both nullable. For repost drafts, `source` SHALL be `'repost'`, `pr_number` SHALL be `0`, `pr_title` SHALL store `@username | tweet-preview`, and `commit_sha` SHALL store the original tweet ID for idempotency.

#### Scenario: Repost draft created
- **WHEN** a repost draft is generated
- **THEN** `source='repost'`, `original_tweet_id` is set to the X tweet ID, and `original_tweet_url` is the tweet's URL

#### Scenario: Idempotency check for reposts
- **WHEN** the poller encounters a tweet that already has a draft (by commit_sha = tweet ID)
- **THEN** the system SHALL skip draft creation

### Requirement: TwitterAccountConfig type
The system SHALL define a `TwitterAccountConfig` interface with fields: `language` ('en' | 'he'), `includeHashtags` (boolean), `alwaysGenerateImage` (boolean), `singleImageProbability` (number 0-1), `relevanceThreshold` (number 1-10, default 6), `tone` (string — e.g. 'professional', 'casual', 'analytical', 'enthusiastic', 'witty'), `autoApprove` (boolean, default false).

#### Scenario: Default config
- **WHEN** a new account is added without custom config
- **THEN** it SHALL use defaults: language='en', includeHashtags=true, alwaysGenerateImage=false, singleImageProbability=0.3, relevanceThreshold=6, tone='professional', autoApprove=false

### Requirement: Add account by @username
The system SHALL validate an @username input, look up the X user via API (`GET /2/users/by/username/:username`), and create a `twitter_accounts` record with the resolved `user_id` and `display_name`.

#### Scenario: Valid username
- **WHEN** user sends "@vercel" or "vercel"
- **THEN** the system SHALL strip the @ prefix, call the X API to resolve the user, and store the account

#### Scenario: Invalid username
- **WHEN** the X API returns 404 for the username
- **THEN** the system SHALL respond with "Account not found" error

### Requirement: Account detail settings view
The account detail view SHALL display the account info and toggle buttons for all configurable settings: follow/unfollow, Bootstrap Overview, language (en/he toggle), hashtags (on/off toggle), image generation (on/off toggle), image probability (cycle: 0/30/50/70/100%), relevance threshold (cycle: 1-10), tone (cycle through options), auto-approve (on/off toggle).

#### Scenario: Toggle relevance threshold
- **WHEN** user clicks the relevance threshold button
- **THEN** the value SHALL increment by 1, wrapping from 10 back to 1

#### Scenario: Toggle tone
- **WHEN** user clicks the tone button
- **THEN** the value SHALL cycle through: professional → casual → analytical → enthusiastic → witty → professional

#### Scenario: Bootstrap overview button
- **WHEN** user clicks "Bootstrap Overview"
- **THEN** the system SHALL fetch X profile data, call Gemini with web search grounding to build a persona, store it in `twitter_account_overviews`, and confirm in the view

### Requirement: Account list view with pagination
The accounts list view SHALL display followed accounts with pagination (10 per page), one button per account showing `@username (display_name)` with watching/paused status icon. An "Add account" button SHALL appear at the top.

#### Scenario: Accounts list with items
- **WHEN** user navigates to the accounts section
- **THEN** they SHALL see a paginated list of followed accounts with status icons

#### Scenario: Empty accounts list
- **WHEN** user has no followed accounts
- **THEN** the view SHALL show a message encouraging them to add accounts with an "Add account" button

#### Scenario: Pagination
- **WHEN** user has more than 10 accounts
- **THEN** Prev/Next pagination buttons SHALL appear with callbacks `page:accounts:N`

### Requirement: Account CRUD database functions
The DB service SHALL provide: `createTwitterAccount(env, chatId, data)`, `getTwitterAccounts(env, chatId)`, `getTwitterAccount(env, accountId, chatId)`, `updateTwitterAccount(env, accountId, chatId, updates)`, `deleteTwitterAccount(env, accountId, chatId)`, `getWatchingTwitterAccounts(env)` (no chatId filter — for poller cron), `getTwitterAccountOverview(env, accountId)`, `upsertTwitterAccountOverview(env, accountId, data)`.

#### Scenario: Get watching accounts for poller
- **WHEN** the poller cron calls `getWatchingTwitterAccounts(env)`
- **THEN** it SHALL return all accounts across all users where `is_watching=1`

#### Scenario: Update last_tweet_id
- **WHEN** `updateTwitterAccount(env, id, chatId, { last_tweet_id: '...' })` is called
- **THEN** the `last_tweet_id` column SHALL be updated and `updated_at` set to now
