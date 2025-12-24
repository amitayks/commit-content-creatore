## ADDED Requirements

### Requirement: Project Configuration
The system SHALL support per-project configuration via YAML files.

#### Scenario: Configuration Loading
- **WHEN** processing a GitHub event
- **THEN** the system loads the matching project configuration
- **AND** applies all settings to content generation

#### Scenario: Default Values
- **WHEN** a configuration option is not specified
- **THEN** sensible defaults are applied
- **AND** the system continues without error

#### Scenario: Configuration Validation
- **WHEN** a project configuration is loaded
- **THEN** required fields are validated (id, repository)
- **AND** invalid configurations are rejected with clear error

---

### Requirement: Trigger Configuration
The system SHALL allow configuring which events trigger content generation.

#### Scenario: Branch Configuration
- **WHEN** branches are configured
- **THEN** only events on those branches trigger generation
- **AND** supports glob patterns (e.g., "release/*")

#### Scenario: Event Type Configuration
- **WHEN** event types are configured (pr_merged, push)
- **THEN** only those event types trigger generation

#### Scenario: File Pattern Configuration
- **WHEN** include/exclude patterns are configured
- **THEN** events are filtered based on changed files
- **AND** exclude patterns take precedence over include

---

### Requirement: Content Style Configuration
The system SHALL support detailed content style and tone settings.

#### Scenario: Tone Setting
- **WHEN** tone is configured
- **THEN** AI prompts include tone guidance
- **AND** options include: formal, casual, technical, enthusiastic, professional-casual

#### Scenario: Content Type Priorities
- **WHEN** content types are configured
- **THEN** AI focuses on those types (technical, feature, learning)
- **AND** can be mixed or single-focus

#### Scenario: Emoji Configuration
- **WHEN** emojis are enabled
- **THEN** generated content includes appropriate emojis
- **WHEN** emojis are disabled
- **THEN** generated content is emoji-free

---

### Requirement: Formatting Configuration
The system SHALL apply consistent formatting based on configuration.

#### Scenario: Hashtag Configuration
- **WHEN** hashtags are configured
- **THEN** "always" hashtags are included in every post
- **AND** "project" hashtags identify the source project

#### Scenario: Thread Size Limits
- **WHEN** thread limits are configured
- **THEN** generated threads respect max_tweets setting
- **AND** content is condensed if necessary

---

### Requirement: Multi-Project Support
The system SHALL support multiple projects with a single X account.

#### Scenario: Project Identification
- **WHEN** multiple projects are configured
- **THEN** each project's content is tagged appropriately
- **AND** all content publishes to the same X account

#### Scenario: Project Isolation
- **WHEN** processing an event
- **THEN** only the matching project's configuration is applied
- **AND** other project settings do not interfere
