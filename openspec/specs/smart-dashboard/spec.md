## ADDED Requirements

### Requirement: Dashboard shows next scheduled post
The dashboard SHALL display the next scheduled post's title (or first tweet text), scheduled time, format, and PR number when a scheduled draft exists.

#### Scenario: Scheduled post exists
- **WHEN** the user views the dashboard and there is at least one scheduled draft
- **THEN** the dashboard SHALL show the next scheduled draft's title, scheduled time, tweet count, and PR number

#### Scenario: No scheduled posts
- **WHEN** the user views the dashboard and there are no scheduled drafts
- **THEN** the dashboard SHALL show a welcome message encouraging content generation

### Requirement: Dashboard shows queue statistics
The dashboard SHALL display aggregate counts of drafts by status: total drafts, approved count, and scheduled count.

#### Scenario: Drafts exist in various statuses
- **WHEN** the user views the dashboard
- **THEN** the dashboard SHALL show counts for draft, approved, and scheduled statuses

#### Scenario: No drafts exist
- **WHEN** the user views the dashboard and there are no drafts
- **THEN** the dashboard SHALL show zero counts or omit the stats line

### Requirement: Dashboard is async with DB access
The `renderHome()` function SHALL accept `env` and `chatId` parameters and query the database for scheduled drafts and status counts.

#### Scenario: Dashboard loads with DB context
- **WHEN** `renderHome(env, chatId)` is called
- **THEN** it SHALL query for the next scheduled draft and draft status counts
- **AND** return a ViewResult with the populated dashboard

### Requirement: Dashboard buttons include dynamic navigation
The dashboard SHALL show contextual buttons based on queue state: "View Schedule" button when scheduled posts exist, and always show Handwrite, Generate, Drafts, Repos, and Help.

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
