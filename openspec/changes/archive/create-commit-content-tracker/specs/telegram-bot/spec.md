## ADDED Requirements

### Requirement: Draft Notification
The system SHALL notify the user via Telegram when new drafts are ready for review.

#### Scenario: New Draft Notification
- **WHEN** a new draft is created
- **THEN** a Telegram message is sent to the configured chat
- **AND** includes a formatted preview of the thread
- **AND** includes inline action buttons

#### Scenario: Preview Formatting
- **WHEN** displaying a draft preview
- **THEN** tweets are shown with numbering (1/N, 2/N, etc.)
- **AND** project name and source link are included
- **AND** character counts are displayed for each tweet

---

### Requirement: Inline Actions
The system SHALL provide inline keyboard buttons for quick actions.

#### Scenario: Approve Button
- **WHEN** user taps "✅ Approve"
- **THEN** draft status is changed to "approved"
- **AND** confirmation message is sent
- **AND** original message buttons are updated

#### Scenario: Reject Button
- **WHEN** user taps "❌ Reject"
- **THEN** draft status is changed to "rejected"
- **AND** confirmation message is sent

#### Scenario: Regenerate Button
- **WHEN** user taps "🔄 Regenerate"
- **THEN** new content generation is triggered
- **AND** "Regenerating..." status is shown
- **AND** new preview replaces the current one

#### Scenario: Edit Button
- **WHEN** user taps "✏️ Edit"
- **THEN** bot responds with edit instructions
- **AND** waits for user reply with edited content

---

### Requirement: Interactive Editing
The system SHALL support editing specific tweets via reply messages.

#### Scenario: Tweet Edit by Reply
- **WHEN** user replies to a draft message with "1: New content here"
- **THEN** tweet #1 is updated with the new content
- **AND** preview is refreshed
- **AND** confirmation is sent

#### Scenario: Invalid Edit Format
- **WHEN** user reply does not match expected format
- **THEN** bot responds with format instructions
- **AND** no changes are made

#### Scenario: Character Limit Exceeded
- **WHEN** edited content exceeds 280 characters
- **THEN** bot responds with error
- **AND** indicates how many characters to remove

---

### Requirement: Bot Commands
The system SHALL respond to Telegram bot commands for queue management.

#### Scenario: Pending Command
- **WHEN** user sends /pending
- **THEN** bot lists all drafts with "draft" status
- **AND** shows count and summary for each

#### Scenario: Queue Command
- **WHEN** user sends /queue
- **THEN** bot lists all drafts with "approved" status waiting for publish
- **AND** shows estimated publish time if scheduled

#### Scenario: Stats Command
- **WHEN** user sends /stats
- **THEN** bot shows summary statistics
- **AND** includes: total drafts, published this week, rejected count

#### Scenario: Help Command
- **WHEN** user sends /help
- **THEN** bot displays available commands and usage
