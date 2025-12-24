## ADDED Requirements

### Requirement: Tweet Publishing
The system SHALL publish approved drafts to X via API v2.

#### Scenario: Single Tweet Publish
- **WHEN** an approved draft with format "single" is published
- **THEN** a single tweet is posted via X API
- **AND** the tweet ID is stored in the draft
- **AND** status is updated to "published"

#### Scenario: Thread Publish
- **WHEN** an approved draft with format "thread" is published
- **THEN** the first tweet is posted
- **AND** subsequent tweets are posted as replies (in_reply_to_tweet_id)
- **AND** all tweet IDs are stored
- **AND** status is updated to "published"

#### Scenario: Media Upload
- **WHEN** a draft includes an AI-generated image
- **THEN** the image is uploaded via media upload endpoint
- **AND** media ID is attached to the appropriate tweet

---

### Requirement: Rate Limit Management
The system SHALL respect X API rate limits and handle throttling.

#### Scenario: Rate Limit Tracking
- **WHEN** publishing tweets
- **THEN** the system tracks API usage against limits
- **AND** stores usage count in state file

#### Scenario: Rate Limit Exceeded
- **WHEN** rate limit is reached
- **THEN** publishing is paused
- **AND** Telegram notification is sent with resume time
- **AND** remaining drafts are queued for later

#### Scenario: Retry on Transient Error
- **WHEN** X API returns a transient error (429, 500, 503)
- **THEN** the system retries with exponential backoff
- **AND** maximum 3 retry attempts

---

### Requirement: Publish Confirmation
The system SHALL confirm successful publishing via Telegram.

#### Scenario: Success Notification
- **WHEN** a draft is published successfully
- **THEN** a Telegram message is sent with the live tweet URL
- **AND** original draft message is updated with "✅ Published" status

#### Scenario: Failure Notification
- **WHEN** publishing fails after all retries
- **THEN** a Telegram message is sent with error details
- **AND** draft status reverts to "approved" for retry

---

### Requirement: Scheduled Publishing
The system SHALL support scheduled publishing of approved drafts.

#### Scenario: Publish Window
- **WHEN** the publisher workflow runs
- **THEN** it processes approved drafts in FIFO order
- **AND** respects configured daily publish limits

#### Scenario: Optimal Timing
- **WHEN** publishing is configured with optimal timing
- **THEN** tweets are published during configured peak hours
- **AND** respects timezone settings
