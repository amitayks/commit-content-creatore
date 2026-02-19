## MODIFIED Requirements

### Requirement: Dashboard buttons include dynamic navigation
The dashboard SHALL show contextual buttons based on queue state: "View Schedule" button when scheduled posts exist, and always show Handwrite, Generate, Drafts, Repos, Help, and Video Studio.

#### Scenario: Video Studio button always shown
- **WHEN** the dashboard renders
- **THEN** a "Video Studio" button SHALL be shown with `callback_data: 'view:video_studio'`

#### Scenario: Scheduled posts exist
- **WHEN** the dashboard renders with scheduled drafts
- **THEN** a "View Schedule" button SHALL be shown linking to the scheduled drafts list

#### Scenario: No scheduled posts
- **WHEN** the dashboard renders without scheduled drafts
- **THEN** the "View Schedule" button SHALL be omitted

#### Scenario: Handwrite button always shown
- **WHEN** the dashboard renders
- **THEN** a "Handwrite" button SHALL always be shown with `callback_data: 'view:handwrite'`
- **AND** it SHALL appear in the same row as the "Generate" button
