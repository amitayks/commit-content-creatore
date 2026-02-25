## ADDED Requirements

### Requirement: Video file storage in R2
The system SHALL store generated video files in R2 at the path `videos/{videoDraftId}/video.mp4` with appropriate content type metadata.

#### Scenario: Store video from HeyGen
- **WHEN** a video is downloaded from HeyGen after generation completes (via webhook callback or cron fallback)
- **THEN** the system SHALL store it in R2 at `videos/{videoDraftId}/video.mp4`
- **AND** set `httpMetadata.contentType` to the video's MIME type (typically `video/mp4`)
- **AND** update the video draft's `video_url` field with the R2 key

#### Scenario: Immediate download on completion
- **WHEN** a HeyGen video generation completes
- **THEN** the system SHALL download and store the video immediately
- **AND** MUST NOT rely on the HeyGen download URL for later access (URLs expire after 7 days)

#### Scenario: Video size validation
- **WHEN** a video is downloaded from HeyGen
- **THEN** the system SHALL validate the file size does not exceed 200MB
- **AND** reject and log an error if the file exceeds the limit

### Requirement: Video serving via media endpoint
The system SHALL serve video files from R2 via a `/media/:key` endpoint (extending the existing `/image/:key` pattern to support video content types).

#### Scenario: Serve video file
- **WHEN** a request is made to `/media/videos/{videoDraftId}/video.mp4`
- **THEN** the system SHALL read the file from R2
- **AND** return it with the correct `Content-Type` header (e.g., `video/mp4`)
- **AND** include `Content-Length` header for proper streaming
- **AND** include `Accept-Ranges` header for range request support

#### Scenario: Path traversal prevention
- **WHEN** a media key contains path traversal characters (`..`, `//`)
- **THEN** the request SHALL be rejected with 400 Bad Request

#### Scenario: Public accessibility for Instagram
- **WHEN** the `/media/:key` endpoint serves a video
- **THEN** the URL SHALL be publicly accessible (no authentication required)
- **AND** this is necessary for Instagram Reels publishing (Meta fetches the video from this URL)

### Requirement: Video preview in Telegram
The system SHALL send video files to Telegram for preview using the Telegram Bot API `sendVideo` method.

#### Scenario: Send video preview
- **WHEN** a user views a completed video draft detail
- **THEN** the system SHALL read the video from R2
- **AND** send it as a Telegram video message with the caption text
- **AND** include inline keyboard buttons for actions (Publish, Schedule, Delete)

#### Scenario: Video too large for Telegram
- **WHEN** the video file exceeds Telegram's 50MB file upload limit
- **THEN** the system SHALL send a text message with a link to view the video via the `/media/` endpoint
- **AND** include a note about the file size

### Requirement: video_drafts table schema
The system SHALL provide a `video_drafts` table in D1 with columns: `id` (TEXT PRIMARY KEY), `chat_id` (TEXT NOT NULL), `repo_id` (TEXT — nullable for standalone videos), `status` (TEXT DEFAULT 'draft' — values: draft, generating, queued, completed, approved, scheduled, published, failed), `script` (TEXT — JSON: the full multi-scene script object), `caption` (TEXT — Instagram caption), `twitter_caption` (TEXT — Twitter caption), `title` (TEXT — short reference title), `config` (TEXT NOT NULL — JSON: full VideoConfig object including character, look, tone, length, engine, emotion, aspect ratio, background, captions, text overlay, commit depth, manual instructions), `heygen_video_id` (TEXT — HeyGen video generation ID), `video_url` (TEXT — R2 key for stored video), `reference_sha` (TEXT — latest commit SHA included in this video), `scheduled_at` (TEXT), `created_at` (TEXT), `updated_at` (TEXT).

#### Scenario: Table creation
- **WHEN** the database migration runs
- **THEN** the `video_drafts` table SHALL be created with all specified columns

#### Scenario: Index on status
- **WHEN** the database migration runs
- **THEN** an index SHALL be created on `video_drafts(status)` for efficient cron and webhook queries

#### Scenario: Index on heygen_video_id
- **WHEN** the database migration runs
- **THEN** an index SHALL be created on `video_drafts(heygen_video_id)` for efficient webhook callback lookup

### Requirement: video_published table schema
The system SHALL provide a `video_published` table with columns: `id` (TEXT PRIMARY KEY), `chat_id` (TEXT NOT NULL), `video_draft_id` (TEXT NOT NULL), `repo_id` (TEXT), `twitter_url` (TEXT), `instagram_url` (TEXT), `caption` (TEXT), `published_at` (TEXT).

#### Scenario: Table creation
- **WHEN** the database migration runs
- **THEN** the `video_published` table SHALL be created with all specified columns

### Requirement: video_presets table schema
The system SHALL provide a `video_presets` table with columns: `id` (TEXT PRIMARY KEY), `chat_id` (TEXT NOT NULL), `name` (TEXT NOT NULL), `config` (TEXT NOT NULL — JSON: full VideoConfig), `created_at` (TEXT).

#### Scenario: Table creation
- **WHEN** the database migration runs
- **THEN** the `video_presets` table SHALL be created with all specified columns
