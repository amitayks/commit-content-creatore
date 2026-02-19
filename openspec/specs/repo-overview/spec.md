## Requirements

### Requirement: repo_overviews table schema
The system SHALL provide a `repo_overviews` table in D1 with the following columns: `id` (TEXT PRIMARY KEY), `repo_id` (TEXT NOT NULL FK to repos.id), `summary` (TEXT — 2-3 sentence project description), `tech_stack` (TEXT — comma-separated technologies), `key_features` (TEXT — JSON array of feature strings, max 10), `target_audience` (TEXT — who uses this project), `brand_voice` (TEXT — tone/style for content), `visual_theme` (TEXT — colors, visual style, mood for image consistency), `recent_changes` (TEXT — JSON array of recent change descriptions, max 20 FIFO), `version` (INTEGER DEFAULT 1), `created_at` (TEXT), `updated_at` (TEXT). A UNIQUE constraint SHALL exist on `repo_id`.

#### Scenario: Table creation
- **WHEN** the database migration runs
- **THEN** the `repo_overviews` table SHALL be created with all specified columns and constraints

#### Scenario: One overview per repo
- **WHEN** an overview is inserted for a repo that already has one
- **THEN** the insert SHALL fail due to the UNIQUE constraint on `repo_id`

### Requirement: Bootstrap overview via /overview command
The system SHALL provide an `/overview owner/repo` Telegram command that bootstraps a repo overview by fetching the README and recent merged PRs from GitHub API, sending them to Gemini for structured extraction, and storing the result in `repo_overviews`.

#### Scenario: Bootstrap with README and PRs available
- **WHEN** user sends `/overview owner/repo` for a watched repo with a README
- **THEN** the system SHALL fetch the README via `GET /repos/{owner}/{repo}/readme` (base64 decoded)
- **AND** fetch the last 10 merged PRs via `GET /repos/{owner}/{repo}/pulls?state=closed&sort=updated&per_page=10`
- **AND** send the content to Gemini with a structured extraction prompt
- **AND** store the extracted overview in `repo_overviews`
- **AND** send a preview message to the user via Telegram

#### Scenario: Bootstrap for repo without README
- **WHEN** user sends `/overview owner/repo` for a repo with no README
- **THEN** the system SHALL fall back to using only PR titles and commit patterns
- **AND** still produce a usable overview with available information

#### Scenario: Bootstrap for unwatched repo
- **WHEN** user sends `/overview owner/repo` for a repo not in the `repos` table
- **THEN** the system SHALL respond with an error message instructing the user to watch the repo first

#### Scenario: Re-bootstrap existing overview
- **WHEN** user sends `/overview owner/repo` for a repo that already has an overview
- **THEN** the system SHALL overwrite the existing overview with freshly extracted data
- **AND** reset the version counter to 1

### Requirement: Overview extraction prompt
The system SHALL use a dedicated Gemini prompt for extracting structured overview data from README content and PR history. The prompt SHALL instruct Gemini to return JSON matching the `RepoOverview` field structure, keeping each field concise (summary: 2-3 sentences, tech_stack: comma list, key_features: max 10 items, target_audience: 1-2 sentences, brand_voice: 1-2 sentences, visual_theme: 1-2 sentences).

#### Scenario: Extraction produces valid structure
- **WHEN** Gemini processes the extraction prompt with README + PR data
- **THEN** the response SHALL be valid JSON with all `RepoOverview` fields populated

#### Scenario: Extraction respects size constraints
- **WHEN** a README is very long (5000+ words)
- **THEN** the extracted overview SHALL still be concise (~500-1000 words total across all fields)

### Requirement: Read overview for content generation
The system SHALL provide a `getRepoOverview(env, repoId)` function that reads the overview from D1 and returns it as a typed `RepoOverview` object, or `null` if no overview exists.

#### Scenario: Overview exists
- **WHEN** `getRepoOverview()` is called for a repo with an overview
- **THEN** it SHALL return the parsed `RepoOverview` with all fields

#### Scenario: No overview exists
- **WHEN** `getRepoOverview()` is called for a repo without an overview
- **THEN** it SHALL return `null`

### Requirement: Apply overview patches
The system SHALL provide an `applyOverviewPatches(env, repoId, patches)` function that applies field-level updates to the stored overview. Patch format: `null` means no change; for array fields (`key_features`, `recent_changes`) the patch is `{ add: string[], remove: string[] }`; for scalar fields the patch is a replacement string.

#### Scenario: Patch adds new key features
- **WHEN** `applyOverviewPatches()` receives `{ key_features: { add: ["passwordless auth"], remove: [] } }`
- **THEN** the `key_features` array in D1 SHALL include "passwordless auth" appended

#### Scenario: Patch updates summary
- **WHEN** `applyOverviewPatches()` receives `{ summary: "New summary text" }`
- **THEN** the `summary` field in D1 SHALL be replaced with "New summary text"

#### Scenario: Null patch means no change
- **WHEN** `applyOverviewPatches()` receives `{ summary: null, tech_stack: null }`
- **THEN** no fields SHALL be modified in D1

#### Scenario: recent_changes FIFO eviction
- **WHEN** a patch adds entries to `recent_changes` and the total exceeds 20
- **THEN** the oldest entries SHALL be removed to keep the array at max 20

#### Scenario: Invalid patch structure ignored
- **WHEN** `applyOverviewPatches()` receives a patch with unexpected structure
- **THEN** the invalid fields SHALL be skipped silently
- **AND** valid fields in the same patch SHALL still be applied
- **AND** a warning SHALL be logged

#### Scenario: Version incremented on patch
- **WHEN** any field is successfully updated by a patch
- **THEN** the `version` field SHALL be incremented by 1
- **AND** `updated_at` SHALL be set to current timestamp

### Requirement: Overview display in repo settings
The repo settings view in Telegram SHALL display the current overview summary and key features when an overview exists, with an "Edit Overview" button.

#### Scenario: Repo has overview
- **WHEN** user views repo settings for a repo with an overview
- **THEN** the view SHALL show the summary (truncated if long) and feature count
- **AND** include an "Edit Overview" button and a "Re-bootstrap" button

#### Scenario: Repo has no overview
- **WHEN** user views repo settings for a repo without an overview
- **THEN** the view SHALL show a message suggesting `/overview owner/repo` to set one up

### Requirement: Manual overview field editing
The system SHALL allow users to edit individual overview fields via Telegram by selecting a field from the edit menu, entering new text, and confirming.

#### Scenario: Edit summary field
- **WHEN** user clicks "Edit Overview" -> "Summary" and sends new text
- **THEN** the `summary` field in `repo_overviews` SHALL be updated with the user's text

#### Scenario: Edit visual_theme field
- **WHEN** user clicks "Edit Overview" -> "Visual Theme" and sends new text
- **THEN** the `visual_theme` field SHALL be updated
- **AND** subsequent image generations for this repo SHALL use the new theme
