## Requirements

### Requirement: PRData includes commit messages
The system SHALL populate `PRData.commitMessages` with the actual commit message strings (first line of each commit) fetched from the GitHub API when processing a PR event.

#### Scenario: PR webhook with multiple commits
- **WHEN** a PR merge webhook is received with 5 commits
- **THEN** the system fetches commit details via `GET /repos/{owner}/{repo}/pulls/{number}/commits` and populates `commitMessages` with all 5 first-line commit messages

#### Scenario: Manual SHA triggers PR lookup
- **WHEN** a user provides a commit SHA and a PR is found via `getContentSource()`
- **THEN** `PRData.commitMessages` is populated with all commit messages from the PR

### Requirement: PRData includes file names
The system SHALL populate `PRData.fileNames` with the list of all changed file paths fetched from the GitHub API when processing a PR event.

#### Scenario: PR webhook with changed files
- **WHEN** a PR merge webhook is received
- **THEN** the system fetches file list via `GET /repos/{owner}/{repo}/pulls/{number}/files` and populates `fileNames` with all file paths

#### Scenario: Manual SHA triggers PR file lookup
- **WHEN** a user provides a commit SHA and a PR is found via `getContentSource()`
- **THEN** `PRData.fileNames` is populated with all changed file paths from the PR

### Requirement: CommitData includes commit messages
The system SHALL populate `CommitData.commitMessages` with the commit message(s) extracted from the push webhook payload or fetched from the GitHub API.

#### Scenario: Push webhook with multiple commits
- **WHEN** a push webhook is received with 3 commits
- **THEN** `CommitData.commitMessages` is populated with the first-line message of each commit from `event.commits[].message`

#### Scenario: Manual SHA with direct commit
- **WHEN** a user provides a SHA and no PR is found (fallback to commit)
- **THEN** `CommitData.commitMessages` contains the commit's title message

### Requirement: CommitData includes file names
The system SHALL populate `CommitData.fileNames` with all changed file paths extracted from the webhook payload or fetched from the GitHub API.

#### Scenario: Push webhook extracts file names
- **WHEN** a push webhook is received
- **THEN** `CommitData.fileNames` is populated by combining `added`, `modified`, and `removed` arrays from all commits in the payload, deduplicated

#### Scenario: Manual SHA fetches file names
- **WHEN** a user provides a SHA and commit data is fetched directly
- **THEN** `CommitData.fileNames` is populated from the commit's `files[].filename` array

### Requirement: Only commit messages and file names are sent to Grok
The `buildContentPrompt()` function SHALL send commit messages, file names, AND the repo overview (if available) to Gemini. It SHALL NOT send PR title, PR body/description, author, stats (additions/deletions/files_changed), or any other metadata. The repo overview is fetched from the `repo_overviews` table and included as structured project context.

#### Scenario: PR content prompt includes repo overview
- **WHEN** `buildContentPrompt()` is called with a PR ContentSource and the repo has an overview
- **THEN** the prompt SHALL contain the repo overview (summary, tech_stack, key_features, target_audience, brand_voice, visual_theme), followed by the list of commit messages and file names

#### Scenario: PR content prompt without repo overview
- **WHEN** `buildContentPrompt()` is called with a PR ContentSource and the repo has no overview
- **THEN** the prompt SHALL contain only the list of commit messages and file names (current behavior preserved)

#### Scenario: Commit content prompt includes repo overview
- **WHEN** `buildContentPrompt()` is called with a commit ContentSource and the repo has an overview
- **THEN** the prompt SHALL contain the repo overview, followed by the commit messages and file names

#### Scenario: buildContentPrompt receives repoId parameter
- **WHEN** `buildContentPrompt()` is called
- **THEN** it SHALL accept a `repoId` parameter to look up the overview
- **AND** the overview lookup SHALL NOT block or fail the prompt if the overview is missing

### Requirement: Remove codeContext from RepoConfig
The system SHALL remove the `codeContext` field from `RepoConfig`, the `CodeContextLevel` type, and all related UI (toggle button in callback handler, display in views).

#### Scenario: Config toggle no longer includes codeContext
- **WHEN** a user views the repo configuration screen
- **THEN** there is no codeContext toggle button or display

### Requirement: Remove tone from RepoConfig
The system SHALL remove the `tone` field from `RepoConfig` and all related UI (toggle button in callback handler, display in views).

#### Scenario: Config toggle no longer includes tone
- **WHEN** a user views the repo configuration screen
- **THEN** there is no tone toggle button or display
