## ADDED Requirements

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
The system SHALL provide a `renderDraftCategories(env, chatId)` view that shows draft category buttons with counts: Auto-generated, Handwritten, Approved (ready to publish), and Scheduled.

#### Scenario: Categories with drafts
- **WHEN** `renderDraftCategories()` is called and drafts exist
- **THEN** it SHALL show buttons for each category with their count in parentheses
- **AND** buttons SHALL be stacked vertically (one per row)
- **AND** categories SHALL include: Auto-generated, Handwritten, Approved, Scheduled

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
- **THEN** it SHALL show drafts with status `draft` or `rejected`

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
