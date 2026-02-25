## ADDED Requirements

### Requirement: Video Studio entry point on dashboard
The main dashboard SHALL include a "Video Studio" button that navigates to the video studio home view.

#### Scenario: Video Studio button visible
- **WHEN** user views the main dashboard
- **THEN** a "Video Studio" button SHALL be displayed in the navigation area

### Requirement: Video Studio home view
The Video Studio home view SHALL display a "Standalone Video" button and a button for each watched repo that has a repo overview configured.

#### Scenario: Repos with overviews shown
- **WHEN** user enters the Video Studio
- **THEN** the view SHALL list each watched repo with a repo overview as a navigation button
- **AND** display a "Standalone Video" button for free-form video creation

#### Scenario: No repos with overviews
- **WHEN** user enters the Video Studio and no repos have overviews
- **THEN** the view SHALL show the "Standalone Video" button
- **AND** display a message suggesting to run `/overview` on repos first

### Requirement: Per-repo video list view
When a user selects a repo in Video Studio, the system SHALL display a view with buttons for video status categories: "Drafts", "Published", "Scheduled", "Approved", and "Create New".

#### Scenario: Repo video home
- **WHEN** user clicks a repo button in Video Studio
- **THEN** the view SHALL show count badges for each status category
- **AND** display navigation buttons for each category plus "Create New"

### Requirement: Video list with pagination
Each video status list (drafts, published, scheduled, approved) SHALL display video items with pagination, similar to the tweet draft list pattern.

#### Scenario: Video draft list with items
- **WHEN** user views the video drafts list for a repo with 8 video drafts
- **THEN** the view SHALL display the first page of items (page size from settings)
- **AND** each item SHALL show a truncated script preview, length, and creation date
- **AND** pagination buttons SHALL be shown if items exceed page size

#### Scenario: Empty video list
- **WHEN** user views a video status list with no items
- **THEN** the view SHALL display "No videos yet" with a "Create New" button

### Requirement: Video detail view
When a user selects a video item from a list, the system SHALL display the video detail with script preview, status, configuration summary, and action buttons.

#### Scenario: Video draft detail
- **WHEN** user clicks a video draft item
- **THEN** the view SHALL display the script text (truncated if long), caption text, video length, tone, character name, and status
- **AND** action buttons SHALL include: "Publish", "Schedule", "Delete", "Regenerate"

#### Scenario: Published video detail
- **WHEN** user clicks a published video item
- **THEN** the view SHALL display the script text, caption, publish date, and platform URLs
- **AND** the video file SHALL be sent as a Telegram video message for preview

#### Scenario: Generating video detail
- **WHEN** user clicks a video with status "generating"
- **THEN** the view SHALL display "Video is being generated..." with the HeyGen job ID
- **AND** show estimated completion time if available

### Requirement: Standalone video creation
The "Standalone Video" flow SHALL allow creating a video without repo context, using only manual instructions and configuration.

#### Scenario: Standalone video create
- **WHEN** user clicks "Standalone Video" → "Create New"
- **THEN** the configuration flow SHALL start with commit depth disabled (locked to 0)
- **AND** manual instructions SHALL be the primary content source
- **AND** no repo overview context SHALL be included in script generation
