## ADDED Requirements

### Requirement: Download user-sent photos from Telegram
The system SHALL provide a `getFileUrl(env, fileId)` function in `services/telegram.ts` that calls the Telegram `getFile` API and returns a download URL.

#### Scenario: Get file URL for a photo
- **WHEN** `getFileUrl(env, fileId)` is called with a valid Telegram file ID
- **THEN** it SHALL call `https://api.telegram.org/bot{token}/getFile` with `file_id` parameter
- **AND** return the full download URL `https://api.telegram.org/file/bot{token}/{file_path}`

### Requirement: Store user media in R2
The system SHALL provide a `storeUserMedia(env, chatId, messageId, fileId)` function in `services/storage.ts` that downloads a photo from Telegram and stores it in R2.

#### Scenario: Store photo from Telegram to R2
- **WHEN** `storeUserMedia()` is called during compose mode
- **THEN** it SHALL call `getFileUrl()` to get the download URL
- **AND** download the file content
- **AND** store it in R2 at key `handwrite/{chatId}/{messageId}.jpg`
- **AND** return the R2 key

#### Scenario: Download fails gracefully
- **WHEN** the Telegram file download fails
- **THEN** `storeUserMedia()` SHALL return `null`
- **AND** the tweet SHALL be buffered without media (text-only)

### Requirement: Per-tweet media in DraftContent
The `Tweet` type SHALL support an optional `mediaKey` field for per-tweet R2 media references.

#### Scenario: Tweet with media key
- **WHEN** a `DraftContent` contains tweets with `mediaKey` fields
- **THEN** each `mediaKey` SHALL reference an R2 object containing the image for that specific tweet

#### Scenario: Draft created from handwrite buffer
- **WHEN** pen-down creates a draft from buffered tweets
- **THEN** tweets with `mediaKey` in the buffer SHALL have their `mediaKey` copied to the `DraftContent.tweets[].mediaKey` field

### Requirement: Publish pipeline supports per-tweet media
The publish pipeline SHALL attach media to individual tweets based on their `mediaKey` field, not just the first tweet.

#### Scenario: Thread with per-tweet images
- **WHEN** `publishDraft()` publishes a thread where individual tweets have `mediaKey` values
- **THEN** each tweet's media SHALL be read from R2 and uploaded to X separately
- **AND** each uploaded media ID SHALL be attached to its corresponding tweet in the thread

#### Scenario: Thread with mixed media and text-only tweets
- **WHEN** a thread has some tweets with media and some without
- **THEN** only tweets with `mediaKey` SHALL have media uploaded and attached
- **AND** tweets without `mediaKey` SHALL be posted as text-only

#### Scenario: Auto-generated draft with first-tweet image
- **WHEN** `publishDraft()` publishes an auto-generated draft (no per-tweet media)
- **THEN** the existing behavior SHALL be preserved: draft-level `image_url` is attached to the first tweet
