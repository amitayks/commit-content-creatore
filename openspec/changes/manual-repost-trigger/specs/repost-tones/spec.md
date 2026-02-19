## ADDED Requirements

### Requirement: Sarcastic tone option
The system SHALL add "sarcastic" to the available tone options in both the TwitterAccountConfig type and the manual repost tone selector. The sarcastic tone generates content that is sharp and incisive with Twitter-style humor — making strong points with wit and a respectful edge, never mean-spirited or personal.

#### Scenario: Sarcastic tone in account config
- **WHEN** user cycles through tone options in account settings
- **THEN** the tone cycle includes "sarcastic" as an option: professional → casual → analytical → enthusiastic → witty → sarcastic → professional

#### Scenario: Sarcastic tone in manual repost
- **WHEN** user selects "sarcastic" tone in the manual repost preview
- **THEN** the generated content uses the sarcastic tone prompt guidelines

### Requirement: Sarcastic tone prompt guidelines
The system SHALL include specific prompt instructions for the sarcastic tone that guide the AI to produce content that: makes sharp observations with humor, uses irony and wit effectively, maintains a respectful edge (never punches down), brings legitimate insights wrapped in cleverness, matches Twitter/X culture of smart commentary.

#### Scenario: Sarcastic tone generation
- **WHEN** content is generated with sarcastic tone
- **THEN** the output contains witty commentary that makes a genuine point, is engaging and shareable, and does not mock the original author personally

### Requirement: Tone label display
The system SHALL display the sarcastic tone with the label "😏 Sarcastic" in account settings and the tone selector UI.

#### Scenario: Tone display in account detail
- **WHEN** an account has tone set to "sarcastic"
- **THEN** the account detail view shows "😏 Sarcastic" as the tone label

#### Scenario: Tone display in repost preview
- **WHEN** "sarcastic" is selected in the manual repost tone selector
- **THEN** the button shows "😏 Sarcastic" with visual indication of selection
