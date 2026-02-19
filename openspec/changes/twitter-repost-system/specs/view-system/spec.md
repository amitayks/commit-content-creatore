## ADDED Requirements

### Requirement: Accounts list view
The system SHALL provide a `renderAccountsList(env, chatId, page)` view that displays followed Twitter accounts with pagination (10 per page). Each account SHALL be a single button showing `👤 @username` with watching/paused status. An "➕ Add account" button SHALL appear at the top.

#### Scenario: Accounts list with items
- **WHEN** `renderAccountsList(env, chatId, 0)` is called with 3 accounts
- **THEN** it SHALL return ViewResult with text "👤 Followed Accounts (3 total)" and buttons for each account

#### Scenario: Account button format
- **WHEN** an account @vercel is watching
- **THEN** its button SHALL be `{ text: '👤 @vercel', callback_data: 'account:ACCOUNT_ID' }`

#### Scenario: Paused account
- **WHEN** an account @vercel has `is_watching=0`
- **THEN** its button SHALL be `{ text: '👤 @vercel (paused)', callback_data: 'account:ACCOUNT_ID' }`

### Requirement: Account detail view
The system SHALL provide a `renderAccountDetail(env, chatId, accountId)` view showing account info and config toggle buttons. Layout SHALL include: account name/username header, watching status, overview status, and settings toggles.

#### Scenario: Account detail with overview
- **WHEN** account has a bootstrapped overview
- **THEN** the view SHALL show overview summary and a "🔄 Re-bootstrap" button

#### Scenario: Account detail without overview
- **WHEN** account has no overview
- **THEN** the view SHALL show "No overview yet" and a "🔍 Bootstrap Overview" button

#### Scenario: Settings buttons layout
- **WHEN** account detail is rendered
- **THEN** settings buttons SHALL include: [🌐 Lang] [#️⃣ Tags], [🖼 Img] [🎲 N%], [📊 Threshold: N] [🎭 Tone], [✅ Auto-approve: ON/OFF], [⏸️ Stop watching / 👁 Start watching], [🗑️ Delete], [◀️ Back]

### Requirement: Add account input view
The system SHALL provide a `renderAddAccount()` view prompting the user to send an @username. It SHALL include a Cancel button returning to the accounts list.

#### Scenario: Add account prompt
- **WHEN** `renderAddAccount()` is called
- **THEN** it SHALL return: text "➕ Add Account\n\nSend me the Twitter/X @username to follow" with a Cancel button

### Requirement: RePosts category in draft categories
The `renderDraftCategories()` view SHALL include a "🔄 RePosts (N)" button showing the count of repost drafts with status 'draft' or 'rejected'. The callback SHALL be `view:drafts_repost`.

#### Scenario: RePosts with drafts
- **WHEN** 5 repost drafts exist with status 'draft' or 'rejected'
- **THEN** the categories view SHALL show "🔄 RePosts (5)" button

#### Scenario: RePosts empty
- **WHEN** no repost drafts exist
- **THEN** the categories view SHALL still show "🔄 RePosts (0)" button

### Requirement: Repost draft list view
The `renderDraftsList()` function SHALL support `listType='repost'` to show only drafts with `source='repost'` and status in ('draft', 'rejected'). Pagination callbacks SHALL use `page:repost:N`. The short code for repost list type SHALL be `'r'`.

#### Scenario: Repost list rendering
- **WHEN** `renderDraftsList(env, chatId, 0, 'repost', 5)` is called
- **THEN** it SHALL query drafts where `source='repost'` and `status IN ('draft', 'rejected')`

#### Scenario: Repost draft title format
- **WHEN** a repost draft has `pr_title='@vercel | Next.js 15.3 is here with major...'`
- **THEN** the list button SHALL show `🔄 @vercel — Next.js 15.3 is here with...`

### Requirement: Repost draft detail view
The `renderDraftDetail()` view SHALL handle repost drafts by showing: "🔄 from @username" header, embedded link to original tweet, status line, format, and draft content. Action buttons SHALL match existing draft status patterns.

#### Scenario: Repost draft detail
- **WHEN** `renderDraftDetail()` is called for a repost draft
- **THEN** the header SHALL show "🔄 from @username"
- **AND** an "🔗 Original Tweet" URL button SHALL link to the `original_tweet_url`

### Requirement: Accounts views in views barrel export
The `views/index.ts` barrel file SHALL re-export `renderAccountsList`, `renderAccountDetail`, and `renderAddAccount` from `views/accounts.ts`.

#### Scenario: Import from barrel
- **WHEN** code imports from `../views/index`
- **THEN** account view functions SHALL be available

## MODIFIED Requirements

### Requirement: Draft categories navigation view
The system SHALL provide a `renderDraftCategories(env, chatId)` view that shows draft category buttons with counts: Auto-generated, Handwritten, RePosts, Approved (ready to publish), Scheduled, and Published.

#### Scenario: Categories with drafts
- **WHEN** `renderDraftCategories()` is called and drafts exist
- **THEN** it SHALL show buttons for each category with their count in parentheses
- **AND** buttons SHALL be stacked vertically (one per row)
- **AND** categories SHALL include: Auto-generated, Handwritten, RePosts, Approved, Scheduled, Published

#### Scenario: Empty state
- **WHEN** `renderDraftCategories()` is called and no drafts exist
- **THEN** it SHALL show a message encouraging content generation with Generate and Handwrite buttons

### Requirement: Draft list accepts status filter
The `renderDraftsList()` function SHALL accept an optional status filter parameter to show only drafts matching specific statuses.

#### Scenario: Auto-generated filter
- **WHEN** `renderDraftsList()` is called with filter `auto`
- **THEN** it SHALL show drafts with source 'auto' and status `draft` or `rejected`

#### Scenario: Repost filter
- **WHEN** `renderDraftsList()` is called with filter `repost`
- **THEN** it SHALL show drafts with source 'repost' and status `draft` or `rejected`

#### Scenario: Approved filter
- **WHEN** `renderDraftsList()` is called with filter `approved`
- **THEN** it SHALL show only drafts with status `approved`

#### Scenario: Scheduled filter
- **WHEN** `renderDraftsList()` is called with filter `scheduled`
- **THEN** it SHALL show only drafts with status `scheduled` ordered by `scheduled_at ASC`
