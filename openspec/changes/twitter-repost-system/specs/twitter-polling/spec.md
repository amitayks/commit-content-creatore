## ADDED Requirements

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
