## ADDED Requirements

### Requirement: Video publish to Twitter
The system SHALL provide a function to publish a video to Twitter (X) by uploading the video file via the chunked media upload API and creating a tweet with the video attached and caption as text.

#### Scenario: Successful Twitter video publish
- **WHEN** `publishVideoToTwitter(env, videoDraft)` is called with a completed video draft
- **THEN** the system SHALL read the video from R2
- **AND** upload via Twitter media upload API (chunked upload for files > 5MB)
- **AND** create a tweet with the uploaded media ID and the caption text (truncated to 280 chars)
- **AND** return the tweet URL

#### Scenario: Twitter video format requirements
- **WHEN** a video is uploaded to Twitter
- **THEN** the video SHALL be MP4 format with H.264 encoding
- **AND** the file size SHALL NOT exceed 512MB
- **AND** the duration SHALL NOT exceed 140 seconds for standard accounts

#### Scenario: Twitter upload failure
- **WHEN** the Twitter media upload fails
- **THEN** the system SHALL return a typed error
- **AND** the video draft status SHALL remain unchanged (user can retry)

### Requirement: Video publish to Instagram Reels
The system SHALL provide a function to publish a video to Instagram as a Reel using the Meta Content Publishing API.

#### Scenario: Successful Instagram Reel publish
- **WHEN** `publishVideoToInstagram(env, videoDraft)` is called with a completed video draft
- **THEN** the system SHALL create a media container via `POST /{ig-user-id}/media` with `media_type=REELS`, `video_url` (publicly accessible R2 URL), and `caption`
- **AND** poll the container status until ready
- **AND** publish via `POST /{ig-user-id}/media_publish`
- **AND** return the Instagram media ID and URL

#### Scenario: Instagram aspect ratio requirement
- **WHEN** a video is published to Instagram Reels
- **THEN** the video SHALL be in 9:16 aspect ratio
- **AND** if the video is not 9:16, the publish SHALL fail with a clear error message

#### Scenario: Instagram container processing
- **WHEN** the media container is created but not yet ready
- **THEN** the system SHALL poll `GET /{container-id}?fields=status_code` until status is "FINISHED"
- **AND** SHALL timeout after 5 minutes of polling

#### Scenario: Instagram publish failure
- **WHEN** the Instagram API returns an error
- **THEN** the system SHALL return a typed error with the API error message
- **AND** the video draft status SHALL remain unchanged

### Requirement: Multi-platform publish
The video publish action SHALL support publishing to one or both platforms based on user selection.

#### Scenario: Publish to both platforms
- **WHEN** user clicks "Publish" on a video draft and selects both Twitter and Instagram
- **THEN** the system SHALL attempt to publish to both platforms
- **AND** update the video_published record with URLs from both platforms
- **AND** report success/failure for each platform independently

#### Scenario: Publish to single platform
- **WHEN** user clicks "Publish" and selects only Twitter
- **THEN** the system SHALL publish to Twitter only
- **AND** the Instagram field in the published record SHALL be null

### Requirement: Video publish record
After successful publishing, the system SHALL create a record in `video_published` table with: id, chat_id, video_draft_id, repo_id, twitter_url, instagram_url, caption, and published_at.

#### Scenario: Published record created
- **WHEN** a video is successfully published to at least one platform
- **THEN** a `video_published` record SHALL be created
- **AND** the video draft status SHALL be updated to "published"
