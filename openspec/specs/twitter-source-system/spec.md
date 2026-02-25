## Stage 1: Cron Execution

### Requirement: Inline parallel cron execution
The scheduled handler SHALL execute per-user cron tasks directly as parallel promises within the same isolate, without HTTP self-fetch fan-out.

#### Scenario: Multiple users with pending work
- **WHEN** the cron trigger fires and 2+ users have watching twitter accounts or scheduled drafts
- **THEN** all users' cron tasks SHALL run concurrently via Promise.allSettled

#### Scenario: One user fails
- **WHEN** one user's cron tasks throw an error
- **THEN** other users' tasks SHALL complete unaffected

### Requirement: Auto-resolve missing user_id
The poller SHALL attempt to resolve missing `user_id` on twitter accounts via X API lookup instead of skipping them.

#### Scenario: Account without user_id
- **WHEN** the poller encounters a twitter account with no user_id
- **THEN** it SHALL call lookupUserByUsername and persist the resolved user_id
- **THEN** it SHALL continue polling that account in the same cycle

#### Scenario: Lookup fails
- **WHEN** the X API lookup fails for an account without user_id
- **THEN** the poller SHALL skip the account (same as current behavior) and log a warning

## Stage 2: Polling

### Requirement: X API user lookup by username
The system SHALL provide a function `lookupUserByUsername(env, username)` that calls `GET /2/users/by/username/:username` with `user.fields=id,name,username,description,profile_image_url,public_metrics`. It SHALL return the user's numeric ID, display name, bio, and follower count.

#### Scenario: Valid username lookup
- **WHEN** `lookupUserByUsername(env, "vercel")` is called
- **THEN** it SHALL return `{ id: "...", name: "Vercel", username: "vercel", description: "...", public_metrics: {...} }`

#### Scenario: Username not found
- **WHEN** the X API returns 404
- **THEN** the function SHALL return `null`

### Requirement: X API user timeline fetching
The system SHALL provide a function `getUserTweets(env, userId, sinceId?, maxResults?)` that calls `GET /2/users/:id/tweets` with `tweet.fields=conversation_id,in_reply_to_user_id,referenced_tweets,created_at,public_metrics,text` and `max_results` (default 20). When `sinceId` is provided, it SHALL pass `since_id` to only return tweets newer than that ID.

#### Scenario: First poll (no sinceId)
- **WHEN** `getUserTweets(env, userId)` is called without sinceId
- **THEN** it SHALL return the most recent 20 tweets from the user

#### Scenario: Subsequent poll with sinceId
- **WHEN** `getUserTweets(env, userId, "123456")` is called
- **THEN** it SHALL return only tweets posted after tweet ID 123456

#### Scenario: No new tweets
- **WHEN** the user has no tweets since the sinceId
- **THEN** it SHALL return an empty array

### Requirement: X API thread fetching via search
The system SHALL provide a function `searchConversation(env, conversationId, username)` that calls `GET /2/tweets/search/recent?query=conversation_id:ID from:username` with the same tweet fields. It SHALL return all tweets in the conversation by that author, ordered chronologically.

#### Scenario: Complete thread fetch
- **WHEN** `searchConversation(env, "111", "vercel")` is called
- **THEN** it SHALL return all tweets by @vercel in conversation 111, sorted by creation time

### Requirement: Thread detection from timeline data
The poller SHALL detect thread tweets by checking: if a tweet has `referenced_tweets` containing `type: "replied_to"` AND the `in_reply_to_user_id` equals the author's own `user_id`, it is a thread continuation. Standalone tweets have `conversation_id` equal to their own `id` and no relevant `referenced_tweets`.

#### Scenario: Standalone tweet
- **WHEN** a tweet has `conversation_id == own id` and no `referenced_tweets`
- **THEN** it SHALL be classified as standalone and stored with `is_thread=0`

#### Scenario: Thread continuation detected
- **WHEN** a tweet has `referenced_tweets: [{type: "replied_to", id: "prev"}]` and `in_reply_to_user_id` matches the author
- **THEN** it SHALL be classified as thread and stored with `is_thread=1`, grouped by `conversation_id`

### Requirement: Thread buffering across poll cycles
The poller SHALL buffer incomplete threads. When thread tweets are detected, they SHALL be stored with `status='buffered'`. The account's `thread_buffer` JSON field SHALL track `{ conversation_id: { tweet_ids: string[], stale_polls: number } }`. Each poll cycle, if no new tweets arrive for a buffered conversation, `stale_polls` increments. At `stale_polls >= 2` (30 min), the thread is considered complete.

#### Scenario: Thread detected mid-writing
- **WHEN** tweet 2/5 of a thread is detected
- **THEN** it SHALL be stored as buffered and the conversation_id added to thread_buffer with stale_polls=0

#### Scenario: Thread continues next poll
- **WHEN** new tweets arrive for a buffered conversation
- **THEN** stale_polls SHALL reset to 0 and new tweets SHALL be added to the buffer

#### Scenario: Thread complete (2 stale polls)
- **WHEN** stale_polls reaches 2 for a conversation
- **THEN** the system SHALL fetch the full thread via `searchConversation()`, update all tweet rows with complete thread data, set `status='pending'` (ready for scoring), and remove the conversation from thread_buffer

### Requirement: last_tweet_id tracking
After each successful poll of an account, the poller SHALL update `twitter_accounts.last_tweet_id` with the highest tweet ID returned. This SHALL be the maximum ID across all tweets (including thread tweets), NOT just non-thread tweets.

#### Scenario: Update after poll
- **WHEN** tweets with IDs ["100", "101", "102"] are fetched
- **THEN** `last_tweet_id` SHALL be updated to "102"

#### Scenario: Empty poll
- **WHEN** no new tweets are returned
- **THEN** `last_tweet_id` SHALL remain unchanged

### Requirement: OAuth 1.0a for read endpoints
The twitter-poller SHALL implement OAuth 1.0a header generation for GET requests to X API v2. The implementation SHALL reuse the same HMAC-SHA1 signature logic as the existing content-bot worker (copy the pure functions).

#### Scenario: GET request authentication
- **WHEN** `getUserTweets()` calls the X API
- **THEN** it SHALL include an OAuth 1.0a Authorization header with proper signature for GET method and URL query parameters

## Stage 3: Scoring

### Requirement: Batch scoring via single Gemini call
The system SHALL score all pending tweets from a poll cycle in a single Gemini API call. The scoring function SHALL accept an array of tweets (with author, text, conversation context) and return an array of `{ tweet_id: string, score: number, reason: string }`.

#### Scenario: Batch with multiple tweets
- **WHEN** 15 new tweets are pending across 10 accounts
- **THEN** all 15 SHALL be sent in one Gemini call and scored individually

#### Scenario: No pending tweets
- **WHEN** no tweets have `status='pending'` after polling
- **THEN** the scoring step SHALL be skipped entirely

### Requirement: Dedicated scoring system prompt
The scoring prompt SHALL be in its own file (`services/scoring-prompt.ts`). It SHALL instruct Gemini to evaluate each tweet for: type of content (release, bug fix, announcement, technical insight, tutorial, opinion, personal, meme), relevance to a tech-focused developer audience, engagement potential, and timeliness. The prompt SHALL return a JSON array of scores 1-10 with brief reasons.

#### Scenario: Release announcement scores high
- **WHEN** a tweet says "We just released v2.0 with major performance improvements"
- **THEN** the score SHALL be 8-10 with reason indicating it's a release announcement

#### Scenario: Personal tweet scores low
- **WHEN** a tweet says "Great coffee this morning"
- **THEN** the score SHALL be 1-2 with reason indicating it's personal/off-topic

#### Scenario: Thread scored as unit
- **WHEN** a complete thread (3 tweets) is submitted for scoring
- **THEN** it SHALL be scored as a single unit based on the full thread content, returning one score for the conversation_id

### Requirement: Per-account threshold filtering
After scoring, tweets SHALL be filtered against each account's `relevanceThreshold` config value. Tweets scoring below the threshold SHALL have their `status` updated to `'skipped'`. Tweets at or above SHALL be updated to `'scored'`.

#### Scenario: Tweet below threshold
- **WHEN** a tweet scores 4 and the account threshold is 6
- **THEN** the tweet `status` SHALL be set to `'skipped'`

#### Scenario: Tweet meets threshold
- **WHEN** a tweet scores 7 and the account threshold is 6
- **THEN** the tweet `status` SHALL be set to `'scored'` with `relevance_score=7` and `relevance_reason` stored

### Requirement: Score and reason stored on tweet record
After scoring, each tweet's `relevance_score` (INTEGER) and `relevance_reason` (TEXT) columns in `twitter_tweets` SHALL be updated with the AI's response.

#### Scenario: Score persistence
- **WHEN** the AI returns `{ tweet_id: "123", score: 8, reason: "Major framework release" }`
- **THEN** the twitter_tweets row with id "123" SHALL have `relevance_score=8` and `relevance_reason="Major framework release"`
