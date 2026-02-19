## MODIFIED Requirements

### Requirement: Dashboard buttons include dynamic navigation
The dashboard SHALL show contextual buttons based on queue state: "View Schedule" button when scheduled posts exist, and always show Handwrite, Generate, Drafts, Repos, Accounts, Video Studio, and Help.

#### Scenario: Scheduled posts exist
- **WHEN** the dashboard renders with scheduled drafts
- **THEN** a "View Schedule" button SHALL be shown linking to the scheduled drafts list

#### Scenario: No scheduled posts
- **WHEN** the dashboard renders without scheduled drafts
- **THEN** the "View Schedule" button SHALL be omitted

#### Scenario: Handwrite button always shown
- **WHEN** the dashboard renders
- **THEN** a "✍️ Handwrite" button SHALL always be shown with `callback_data: 'view:handwrite'`
- **AND** it SHALL appear in the same row as the "⚡ Generate" button

#### Scenario: Accounts button always shown
- **WHEN** the dashboard renders
- **THEN** a "👤 Accounts" button SHALL always be shown with `callback_data: 'view:accounts'`
- **AND** it SHALL appear in the same row as the "📦 Repos" button
