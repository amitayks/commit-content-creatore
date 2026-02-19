## ADDED Requirements

### Requirement: Quick actions support repost drafts
All existing quick actions (list approve, list publish, list delete, list confirm delete, list cancel delete) SHALL work with repost drafts (`source='repost'`). The `listType='repost'` with short code `'r'` SHALL be supported in the context parsing.

#### Scenario: Quick approve repost draft
- **WHEN** user taps ✅ on a repost draft in the RePosts list
- **THEN** the draft status SHALL update to 'approved' and the list SHALL re-render

#### Scenario: Quick publish repost draft
- **WHEN** user taps 📤 on an approved repost draft
- **THEN** the draft SHALL be published as a quote tweet on X and the list SHALL re-render

#### Scenario: Quick delete repost draft
- **WHEN** user taps 🗑 on a repost draft in the RePosts list
- **THEN** a confirmation prompt SHALL appear with the draft title

### Requirement: Repost list type in short code mapping
The `listTypeToShort` and `shortToListType` mappings SHALL include repost: `{ repost: 'r' }` and `{ r: 'repost' }`.

#### Scenario: Callback data encoding
- **WHEN** a repost draft quick action is rendered
- **THEN** the context SHALL use `r` as the short code (e.g., `action:la:DRAFT_ID:r:0`)

### Requirement: Repost draft title in quick actions
The quick-action list SHALL display repost drafts with the `🔄` emoji prefix and show `@username — tweet-preview...` format (parsed from `pr_title`).

#### Scenario: Repost draft in list
- **WHEN** a repost draft appears in the RePosts list
- **THEN** the title button SHALL show `🔄 @vercel — Next.js 15.3 is here...`
