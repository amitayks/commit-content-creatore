## ADDED Requirements

### Requirement: Store media URL at poll time
The system SHALL store the first relevant media URL (photo URL or video thumbnail) for each tweet in the `twitter_tweets.media_url` column when polling followed accounts.

#### Scenario: Tweet with photo
- **WHEN** the poller fetches a tweet that has an attached photo
- **THEN** the system stores the photo's `url` field as `media_url` in `twitter_tweets`

#### Scenario: Tweet with video
- **WHEN** the poller fetches a tweet that has an attached video or animated GIF
- **THEN** the system stores the video's `preview_image_url` (thumbnail) as `media_url` in `twitter_tweets`

#### Scenario: Tweet with no media
- **WHEN** the poller fetches a tweet with no media attachments
- **THEN** the `media_url` column SHALL be NULL

#### Scenario: Tweet with multiple media
- **WHEN** the poller fetches a tweet with multiple media attachments
- **THEN** the system stores only the first photo URL (or first video thumbnail if no photos)

### Requirement: X API media expansions in poller
The poller's `getUserTweets` call SHALL request media expansions (`attachments.media_keys`) with `media.fields` including `media_key,type,url,preview_image_url` to receive media metadata alongside tweet data.

#### Scenario: API request includes media fields
- **WHEN** the poller calls `getUserTweets` for a followed account
- **THEN** the request includes `attachments` in `tweet.fields`, `attachments.media_keys` in `expansions`, and `media_key,type,url,preview_image_url` in `media.fields`

### Requirement: Multimodal repost generation
When `analyzeMedia` is enabled and a tweet has a `media_url`, the repost generation flow SHALL fetch the image, base64-encode it, and send it as an `inline_data` part alongside the text prompt to Gemini.

#### Scenario: Generation with media enabled and image available
- **WHEN** generating a repost for a tweet that has `media_url` AND `analyzeMedia` is true
- **THEN** the system fetches the image, base64-encodes it, and includes it as a multimodal part in the Gemini API call

#### Scenario: Generation with media enabled but image fetch fails
- **WHEN** generating a repost for a tweet that has `media_url` AND the image fetch fails
- **THEN** the system continues generation with text-only (graceful fallback)

#### Scenario: Generation with media disabled
- **WHEN** generating a repost for a tweet that has `media_url` AND `analyzeMedia` is false
- **THEN** the system generates text-only, ignoring the media

#### Scenario: Manual repost always includes media
- **WHEN** generating via manual `/repost` flow AND the tweet has media
- **THEN** media is always included regardless of account config (no toggle for manual)

### Requirement: Account config analyzeMedia toggle
The `TwitterAccountConfig` SHALL include an `analyzeMedia: boolean` field (default `true`) that controls whether media is sent to the AI during repost generation for that account's tweets.

#### Scenario: Toggle in account settings
- **WHEN** a user views account configuration for a followed account
- **THEN** an "Analyze Media" toggle button is visible alongside existing toggles (hashtags, image generation, etc.)

#### Scenario: Toggle changes config
- **WHEN** a user toggles the analyzeMedia setting
- **THEN** the config is updated and subsequent repost generations for that account respect the new setting

### Requirement: Prompt awareness of attached images
When media is included in the Gemini call, the repost prompt SHALL inform the AI that an image is attached and instruct it to reference visual content when relevant.

#### Scenario: Prompt includes image note
- **WHEN** an image is included in the Gemini multimodal request
- **THEN** the text prompt includes a note telling the AI the original tweet has an attached image and to consider its content

#### Scenario: Prompt without image note
- **WHEN** no image is included in the request
- **THEN** the prompt does not mention any image
