# Publishing Capability

## ADDED Requirements

### Requirement: Publish Tweet Thread
The system MUST publish tweet threads to X (Twitter) with proper threading.

#### Scenario: Publish single tweet
**Given** a draft with 1 tweet: "Just shipped OAuth! 🚀"
**When** `publishDraft(draft)` is called
**Then** the system:
  1. Posts the tweet via X API v2
  2. Returns the tweet ID and URL
  3. Updates draft status to 'published'
  4. Saves to `published` table

#### Scenario: Publish thread with multiple tweets
**Given** a draft with 3 tweets
**When** published
**Then** the system:
  1. Posts tweet 1 (returns ID)
  2. Posts tweet 2 as reply to tweet 1
  3. Posts tweet 3 as reply to tweet 2
  4. Waits 1 second between tweets (rate limit)
  5. Returns all tweet IDs and thread URL

#### Scenario: Thread posting fails mid-way
**Given** tweets 1 and 2 posted successfully
**When** tweet 3 fails (e.g., rate limit)
**Then** the system:
  - Does NOT roll back (partial thread is ok)
  - Retries tweet 3 with exponential backoff
  - If still fails after 3 retries, marks draft as 'publish_failed'
  - Stores error message for debugging

---

### Requirement: Media Upload and Attachment
The system MUST upload images and attach them to tweets.

#### Scenario: Upload image before posting
**Given** a generated image (base64 or buffer)
**When** `uploadMedia(imageData)` is called
**Then** the system:
  1. Calls X media upload endpoint (v1.1)
  2. Uploads as multipart/form-data
  3. Returns media_id_string

#### Scenario: Attach image to first tweet
**Given** a thread with 3 tweets and a media_id
**When** publishing
**Then** only the first tweet includes the media
**And** subsequent tweets are text-only

#### Scenario: Media upload fails
**Given** image data is corrupted or too large
**When** upload fails
**Then** the system logs the error
**And** publishes thread without image
**And** marks the published record with `image_failed: true`

---

### Requirement: Published Archive
The system MUST archive all published posts for reference and deletion.

#### Scenario: Record published post
**Given** a draft is published successfully
**When** `createPublished(draft, tweetIds, url)` is called
**Then** the database stores:
  - Unique ID
  - Original draft_id
  - PR number
  - All tweet IDs (JSON array)
  - Thread URL (first tweet link)
  - Image URL (if any)
  - published_at timestamp

#### Scenario: Query published by PR
**Given** 3 posts published from PR #42
**When** `getPublishedByPR(42)` is called
**Then** all 3 records are returned
**And** ordered by published_at descending

---

### Requirement: Delete Published Post
The system MUST allow deleting published tweets from X.

#### Scenario: Delete single tweet
**Given** a published post with 1 tweet
**When** `deleteTweet(tweetId)` is called
**Then** the tweet is deleted from X
**And** the published record is removed from database

#### Scenario: Delete thread
**Given** a published post with 3 tweets
**When** user deletes the post
**Then** ALL 3 tweets are deleted from X
**And** the published record is removed

#### Scenario: Tweet already deleted on X
**Given** tweet was manually deleted from X
**When** the system tries to delete it
**Then** the system treats 404 as success
**And** removes the published record anyway

---

### Requirement: Scheduled Publishing
The system MUST automatically publish posts at their scheduled time.

#### Scenario: Cron job finds due posts
**Given** 2 drafts with `scheduled_at` in the past
**When** the hourly cron job runs
**Then** both drafts are published
**And** status changes to 'published'
**And** notifications are sent to Telegram

#### Scenario: Scheduled publish fails
**Given** a scheduled draft that fails to publish
**When** the cron job processes it
**Then** status changes to 'schedule_failed'
**And** a notification is sent: "⚠️ Scheduled post failed: [reason]"
**And** the draft remains for manual retry

#### Scenario: Multiple posts scheduled same time
**Given** 5 posts scheduled for the same minute
**When** cron runs
**Then** posts are published sequentially
**And** 2 second delay between each (avoid rate limits)

---

### Requirement: Rate Limit Handling
The system MUST gracefully handle X API rate limits.

#### Scenario: Rate limited during publish
**Given** X API returns 429 Too Many Requests
**When** retry header says "retry after 900 seconds"
**Then** the system:
  - Marks draft as 'rate_limited'
  - Stores retry_after timestamp
  - Notifies user with wait time

#### Scenario: Retry after rate limit clears
**Given** a rate_limited draft with retry_after passed
**When** the cron job runs
**Then** the draft is retried
**And** if successful, status changes to 'published'
