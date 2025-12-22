## ADDED Requirements

### Requirement: Thread Content Generation
The system SHALL generate engaging X thread content from GitHub events using Grok AI.

#### Scenario: Successful Generation
- **WHEN** the content generator receives GitHub event context
- **THEN** it sends a structured prompt to Grok API
- **AND** receives thread content with proper formatting
- **AND** stores the result as a draft

#### Scenario: Format Decision
- **WHEN** generating content
- **THEN** the AI autonomously decides between single tweet and thread format
- **AND** bases decision on scope and complexity of changes

#### Scenario: Character Limit Compliance
- **WHEN** content is generated
- **THEN** each tweet in the thread is 280 characters or less
- **AND** includes appropriate line breaks for readability

---

### Requirement: Content Style Configuration
The system SHALL apply project-specific style and tone settings to generated content.

#### Scenario: Tone Application
- **WHEN** generating content for a project
- **THEN** the AI prompt includes the configured tone (formal, casual, technical, enthusiastic)
- **AND** the output reflects that tone consistently

#### Scenario: Content Type Focus
- **WHEN** a project is configured for specific content types (technical, feature, learning)
- **THEN** the AI prioritizes those content types in generation
- **AND** can mix types based on the specific changes

#### Scenario: Hashtag Inclusion
- **WHEN** content is generated
- **THEN** configured hashtags are included
- **AND** project-specific hashtags are added for identification

---

### Requirement: Image Generation
The system SHALL generate optional images for threads using Grok's image capabilities.

#### Scenario: Thread Image
- **WHEN** a thread has 3 or more tweets
- **THEN** an image is generated to accompany the first tweet
- **AND** the image visually represents the main concept

#### Scenario: Image Skip
- **WHEN** a single tweet is generated
- **THEN** image generation is optional based on configuration

---

### Requirement: AI Provider Fallback
The system SHALL fall back to alternative AI providers if Grok is unavailable.

#### Scenario: Grok Failure
- **WHEN** Grok API returns an error or times out after retries
- **THEN** the system attempts generation with Claude (Anthropic)
- **AND** logs the fallback event

#### Scenario: All Providers Fail
- **WHEN** all configured AI providers fail
- **THEN** the system marks the event as failed
- **AND** notifies via Telegram with error details
