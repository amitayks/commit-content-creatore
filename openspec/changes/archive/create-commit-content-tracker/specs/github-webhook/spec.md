## ADDED Requirements

### Requirement: GitHub Webhook Reception
The system SHALL receive and process GitHub webhook events for configured repositories.

#### Scenario: PR Merge Event
- **WHEN** a pull request is merged on a configured branch
- **THEN** the system extracts the PR title, description, commits, and diff
- **AND** triggers content generation workflow

#### Scenario: Push Event
- **WHEN** commits are pushed to a configured branch
- **THEN** the system extracts commit messages and diff
- **AND** waits for debounce period (5 minutes) before processing
- **AND** triggers content generation workflow

#### Scenario: Filtered Event
- **WHEN** a webhook event does not match configured triggers (branch, file patterns)
- **THEN** the system logs the skip reason
- **AND** does not trigger content generation

---

### Requirement: GitHub Context Extraction
The system SHALL extract comprehensive context from GitHub events for AI consumption.

#### Scenario: Diff Extraction
- **WHEN** processing a GitHub event
- **THEN** the system retrieves the full diff of all changed files
- **AND** includes file paths, line additions, and line removals

#### Scenario: Commit Message Extraction
- **WHEN** processing a push or PR event
- **THEN** the system retrieves all commit messages in the event
- **AND** preserves commit author and timestamp

#### Scenario: Repository Context
- **WHEN** generating content
- **THEN** the system includes repository name, description, and primary language
- **AND** retrieves README excerpt if available

---

### Requirement: Event Filtering
The system SHALL filter events based on project configuration.

#### Scenario: Branch Filter
- **WHEN** an event occurs on a non-configured branch
- **THEN** the event is skipped

#### Scenario: File Pattern Include
- **WHEN** an event contains files matching include patterns
- **THEN** the event is processed

#### Scenario: File Pattern Exclude
- **WHEN** all changed files match exclude patterns
- **THEN** the event is skipped
