### Requirement: Views split into domain-specific files
The monolithic `views/index.ts` SHALL be split into domain-specific modules: `views/home.ts` for general views, `views/drafts.ts` for draft-related views, and `views/repos.ts` for repository-related views.

#### Scenario: Home views in home.ts
- **WHEN** `renderHome()`, `renderHelp()`, `renderError()`, `renderSuccess()`, `renderGenerating()`, or `renderPublishing()` is needed
- **THEN** it is imported from `views/home.ts`
- **AND** `renderHome()` SHALL accept `env` and `chatId` parameters (async)

#### Scenario: Draft views in drafts.ts
- **WHEN** `renderDraftCategories()`, `renderDraftsList()`, `renderDraftDetail()`, `renderGeneratePrompt()`, `renderSchedulePrompt()`, or `renderDeletePrompt()` is needed
- **THEN** it is imported from `views/drafts.ts`

#### Scenario: Repo views in repos.ts
- **WHEN** `renderReposList()`, `renderRepoDetail()`, `renderAddRepo()`, or `renderDeleteRepoConfirm()` is needed
- **THEN** it is imported from `views/repos.ts`
- **AND** `renderRepoConfig()` SHALL be removed (merged into `renderRepoDetail()`)

### Requirement: Views barrel re-export for migration
A `views/index.ts` barrel file SHALL re-export all views from the domain files during migration, so existing imports continue to work. Once all imports are updated, the barrel MAY be removed.

#### Scenario: Existing import still works
- **WHEN** a file imports `renderHome` from `../views/index`
- **THEN** it resolves correctly through the barrel re-export

### Requirement: All view functions preserve exact signatures
Each view function SHALL maintain its exact current signature and return type (`ViewResult`). No view function parameters, return types, or rendered content SHALL change.

#### Scenario: renderDraftsList signature unchanged
- **WHEN** `renderDraftsList(env, chatId, page)` is called
- **THEN** it returns the same `ViewResult` with identical text and keyboard as the current implementation

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

### Requirement: Combined Back and Home buttons in list views
All list views SHALL render the Back and Home buttons in the same inline row instead of separate rows.

#### Scenario: Draft list shows combined navigation row
- **WHEN** a draft list is rendered
- **THEN** the bottom row contains `[◀️ Back] [🏠 Home]` in a single row

#### Scenario: Empty draft list shows combined navigation row
- **WHEN** an empty draft list is rendered
- **THEN** the bottom row contains `[◀️ Back] [🏠 Home]` in a single row

### Requirement: Draft list two-row layout with configurable page size
The draft list SHALL display each draft as two rows: a title button row and a quick-action button row. Page size is controlled by the user's configured page size (default 5). Button text SHALL include status emoji and display title.

#### Scenario: Draft list layout
- **WHEN** `renderDraftsList()` renders a page of drafts
- **THEN** each draft SHALL have two rows: a title button and a quick-action row
- **AND** the page SHALL show up to the user's configured page size (default 5)
- **AND** the title button text SHALL show status emoji and display title

#### Scenario: Auto-generated draft title shows repo name and tweet content
- **WHEN** an auto-generated draft is displayed in a list
- **AND** the `pr_title` contains a ` | ` separator (format: `repoName | originalTitle`)
- **THEN** the button label shows `📝 repoShort — tweet-preview...`
- **AND** `repoShort` is the repo name truncated to 10 characters
- **AND** `tweet-preview` is the first tweet text from parsed `content` JSON, truncated

#### Scenario: Old auto-draft without repo name falls back
- **WHEN** an auto-generated draft is displayed in a list
- **AND** the `pr_title` does NOT contain a ` | ` separator
- **THEN** the button label falls back to current format using `pr_title` as-is

#### Scenario: Repo name stored at creation time
- **WHEN** a draft is created via GitHub webhook or `/generate` command
- **THEN** `pr_title` is stored as `repoShortName | originalTitle`

#### Scenario: Draft list pagination with type
- **WHEN** the user navigates pages in a filtered draft list
- **THEN** pagination callbacks SHALL include the list type (e.g., `page:auto:1`, `page:approved:0`)
- **AND** the correct filtered results SHALL be returned

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

### Requirement: Repo list vertical stacking with pagination
The repo list SHALL display buttons stacked vertically (one button per row) with up to 10 items per page.

#### Scenario: Repo list layout
- **WHEN** `renderReposList()` renders repos
- **THEN** each repo SHALL be a single button on its own row
- **AND** pages SHALL show up to 10 repos

#### Scenario: Repo pagination
- **WHEN** the user has more than 10 repos
- **THEN** pagination buttons SHALL appear with callbacks like `page:repos:1`

### Requirement: Merged repo detail and config view
The `renderRepoDetail()` view SHALL include all configuration toggle buttons inline, replacing the separate `renderRepoConfig()` screen.

#### Scenario: Repo detail shows config toggles
- **WHEN** a user views a specific repo
- **THEN** they SHALL see config toggles (language, hashtags, PRs, pushes, thread image, single image probability) as inline buttons
- **AND** they SHALL see action buttons (stop/start watching, delete)
- **AND** there SHALL be no separate "Edit" button

#### Scenario: Config toggle updates merged view
- **WHEN** a user taps a config toggle button
- **THEN** the config SHALL update and the merged repo detail view SHALL re-render

### Requirement: Approve action returns draft detail
The approve action SHALL update the draft status and return `renderDraftDetail()` so the user stays on the same screen with updated buttons.

#### Scenario: Approve draft inline transition
- **WHEN** user clicks "Approve" on a draft detail screen
- **THEN** the draft status SHALL change to `approved`
- **AND** the screen SHALL re-render as draft detail with approved-state buttons (Publish Now, Schedule, Cancel)

### Requirement: Publish action returns draft detail with URL
The publish action SHALL publish the draft and return `renderDraftDetail()` which shows published state with a "View on X" URL button.

#### Scenario: Publish draft inline transition
- **WHEN** user clicks "Publish Now" on an approved draft
- **THEN** the draft SHALL be published to X
- **AND** the screen SHALL re-render as draft detail in published state
- **AND** a "View on X" button with the tweet URL SHALL be shown

### Requirement: Draft detail shows published state with URL button
The `renderDraftDetail()` view SHALL handle published status by showing the tweet content and a URL button to view the post on X.

#### Scenario: Published draft detail view
- **WHEN** `renderDraftDetail()` is called for a published draft
- **THEN** it SHALL show the tweet content
- **AND** it SHALL include a "View on X" button using Telegram's URL button feature
- **AND** no action buttons (approve, edit, reject) SHALL be shown

### Requirement: InlineButton type supports URL buttons
The `InlineButton` type SHALL support an optional `url` field for Telegram URL buttons alongside the existing `callback_data` field.

#### Scenario: URL button in keyboard
- **WHEN** a ViewResult keyboard includes a button with `url` field
- **THEN** the Telegram API call SHALL send it as a URL button (not callback)

### Requirement: Compose mode view
The system SHALL provide a `renderCompose(tweetsCount, charWarnings, imageGen, aiRefine)` view that shows the compose status message with toggle buttons.

#### Scenario: Initial compose view (0 tweets)
- **WHEN** `renderCompose(0, [], false, false)` is called
- **THEN** it SHALL return text "✍️ Composing... (0 tweets)\n\nSend your tweets below. Each message = one tweet.\nEdit any message to update it."
- **AND** keyboard SHALL have: Row 1: [✏️ Pen Down], Row 2: [🎨 Image: OFF] [✨ AI: OFF], Row 3: [❌ Cancel]
- **AND** Pen Down callback SHALL be `compose:pendown`
- **AND** toggle callbacks SHALL be `compose:toggle_image` and `compose:toggle_ai`
- **AND** Cancel callback SHALL be `compose:cancel`

#### Scenario: Compose view with tweets and warnings
- **WHEN** `renderCompose(3, [2], true, false)` is called (3 tweets, tweet 2 over limit, image ON)
- **THEN** text SHALL show "✍️ Composing... (3 tweets)\n⚠️ Tweet 2 exceeds 280 characters"
- **AND** the Image button SHALL show "🎨 Image: ON"
- **AND** the AI button SHALL show "✨ AI: OFF"

### Requirement: Handwritten draft category in categories view
The draft categories navigation SHALL include a "Handwritten" category showing the count of handwritten drafts.

#### Scenario: Handwritten drafts exist
- **WHEN** `renderDraftCategories()` is called and handwritten drafts exist
- **THEN** it SHALL show a "✍️ Handwritten (N)" button linking to `view:drafts_handwrite`
- **AND** the button SHALL be stacked vertically with other category buttons

#### Scenario: No handwritten drafts
- **WHEN** `renderDraftCategories()` is called and no handwritten drafts exist
- **THEN** the "Handwritten" category button SHALL still appear with count 0

### Requirement: Handwritten draft list filter
The `renderDraftsList()` function SHALL support a `handwrite` filter to show only handwritten drafts.

#### Scenario: Handwrite filter
- **WHEN** `renderDraftsList()` is called with filter `handwrite`
- **THEN** it SHALL show only drafts with `source = 'handwrite'` and status in (`draft`, `rejected`)
- **AND** pagination callbacks SHALL use `page:handwrite:N`

### Requirement: Draft detail shows per-tweet media indicators
The `renderDraftDetail()` view SHALL indicate which tweets have attached media when displaying a handwritten draft.

#### Scenario: Handwritten draft with media
- **WHEN** `renderDraftDetail()` displays a handwritten thread where some tweets have media
- **THEN** tweets with media SHALL show a 📷 indicator next to the tweet text in the preview

### Requirement: Draft categories view
The home dashboard SHALL conditionally render the Video Studio button. It is shown ONLY when `isAdmin(chatId, env)` returns true. All other buttons (Handwrite, Generate, Drafts, Repos, Accounts, Settings, Help) are shown to all users.

#### Scenario: Admin user views home
- **WHEN** an admin user views the home dashboard
- **THEN** the Video Studio button is displayed alongside all other buttons

#### Scenario: Regular user views home
- **WHEN** a non-admin user views the home dashboard
- **THEN** the Video Studio button is NOT displayed, all other buttons are shown

### Requirement: Video Studio home includes Video Settings button
The Video Studio home screen SHALL include a "Video Settings" button that navigates to the video settings sub-section (characters, defaults, HeyGen account, Instagram).

#### Scenario: Admin opens Video Studio
- **WHEN** admin navigates to Video Studio home
- **THEN** the screen shows the repo list, Standalone Video button, AND a "Video Settings" button

### Requirement: Safety check on video_studio view
The `view:video_studio` handler SHALL check `isAdmin(chatId, env)` and return a "not available" message if the requesting user is not admin.

#### Scenario: Non-admin triggers video_studio view
- **WHEN** a non-admin user somehow triggers `view:video_studio` callback
- **THEN** the bot responds with "This feature is not available" and does not render Video Studio

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
