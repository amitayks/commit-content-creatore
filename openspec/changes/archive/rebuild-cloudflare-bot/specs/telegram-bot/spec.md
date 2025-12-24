# Telegram Bot Capability

## ADDED Requirements

### Requirement: Conversational Message Flow
The bot MUST follow a conversational pattern: text messages get new responses, button clicks update the current message.

#### Scenario: User sends any text command
**Given** the user sends a text message (e.g., `/start`, `/generate abc123`, or raw SHA)
**When** the bot processes the message
**Then** the bot sends a NEW message as a response
**And** saves this new message ID as the current dashboard
**And** the conversation flows naturally (message → response)

#### Scenario: User clicks any button
**Given** the user clicks a button on the current message
**When** the bot processes the callback
**Then** the bot EDITS the current message (no new message sent)
**And** the UI updates silently without adding to chat history

#### Scenario: Button leads to user input, then user sends text
**Given** the user clicks `⚡ Generate` button
**When** the message updates to show "Send me a commit SHA..."
**And** the user sends `abc123`
**Then** the bot sends a NEW message with the draft preview
**And** saves this new message ID as the current dashboard

#### Scenario: Message too old to edit after button click
**Given** the current dashboard message is over 48 hours old
**When** the user clicks a button
**Then** the bot sends a NEW message instead
**And** updates chat state with new message ID

---

### Requirement: Bot Initialization
The bot MUST display a welcome dashboard when a user sends the `/start` command.

#### Scenario: User starts the bot
**Given** a user opens the Telegram bot
**When** the user sends `/start`
**Then** the bot sends a NEW dashboard message with 6 action buttons:
  - Row 1: `✅ Approve` | `⚡ Generate` | `📝 Drafts`
  - Row 2: `❓ Help` | `📅 Schedule` | `🗑️ Delete`
**And** saves the message ID to chat state

#### Scenario: User sends /start again
**Given** a user already has a dashboard message
**When** the user sends `/start` again
**Then** the bot sends a NEW dashboard message (conversational response)
**And** replaces the old message ID in chat state

---

### Requirement: Drafts List View
The bot MUST display a paginated list of drafts when navigating to Drafts.

#### Scenario: View drafts via button
**Given** the user clicks `📝 Drafts` button
**When** there are drafts in the database
**Then** the CURRENT message is EDITED to show drafts list with:
  - Status emoji (📝 draft, ✅ approved, 📅 scheduled, ❌ rejected)
  - PR title (truncated to 30 chars)
  - Created date
**And** each draft has a clickable button

#### Scenario: View drafts via command
**Given** the user sends `/drafts`
**When** there are drafts in the database
**Then** the bot sends a NEW message with the drafts list

#### Scenario: No drafts exist
**Given** the user navigates to Drafts
**When** there are no drafts
**Then** message shows "No drafts yet. Use ⚡ Generate to create one!"

#### Scenario: Pagination navigation
**Given** there are 12 drafts total
**When** user clicks "Next ➡️" button
**Then** the CURRENT message is EDITED to show next page

---

### Requirement: Draft Detail View
The bot MUST show full draft content with action buttons when a draft is selected.

#### Scenario: View draft detail via button
**Given** the user clicks on a draft from the list
**When** the draft exists
**Then** the CURRENT message is EDITED to show:
  - PR title and number
  - Full tweet content (all tweets in thread)
  - Character count per tweet
  - Status badge
**And** action buttons based on status:
  - Draft: `✅ Approve` | `✏️ Edit` | `❌ Reject` / `🔄 Regenerate` | `📅 Schedule`
  - Approved: `📤 Publish Now` | `📅 Schedule` / `❌ Cancel`
  - Scheduled: `📤 Publish Now` | `❌ Cancel`
**And** a `◀️ Back` button

#### Scenario: Draft action via button
**Given** the user clicks `✅ Approve` on a draft
**When** processing completes
**Then** the CURRENT message is EDITED to show success/confirmation

---

### Requirement: Generate Command
The bot MUST generate content from a commit SHA.

#### Scenario: Generate via button (two-step)
**Given** the user clicks `⚡ Generate` button
**When** the dashboard updates
**Then** the CURRENT message is EDITED to show "Send me a commit SHA or PR number"
**And** chat state is set to `awaiting_input: 'commit_sha'`

#### Scenario: User sends SHA after Generate button
**Given** the user clicked Generate and is awaiting input
**When** the user sends `abc123` (text message)
**Then** the bot sends a NEW message: "🔄 Finding PR for commit abc123..."
**And** the bot updates this NEW message with generation progress
**And** finally shows draft preview with approve/reject buttons

#### Scenario: Generate via command (direct)
**Given** the user sends `/generate abc123`
**When** the commit SHA is valid
**Then** the bot sends a NEW message showing:
  1. "🔄 Finding PR for commit abc123..."
  2. Updates to "📝 Generating content for PR #42..."
  3. Updates to show draft preview with buttons

#### Scenario: Invalid commit SHA
**Given** the user sends an invalid SHA
**When** GitHub API returns 404
**Then** the NEW message shows "❌ Commit not found. Check the SHA and try again."

#### Scenario: Commit not in any PR
**Given** the commit exists but is not in a merged PR
**When** checked
**Then** the NEW message shows "⚠️ This commit is not part of a merged PR."

---

### Requirement: Approve Command
The bot MUST publish all approved drafts when Approve is used.

#### Scenario: Publish via button
**Given** there are approved drafts
**When** user clicks `✅ Approve` on the dashboard
**Then** the CURRENT message is EDITED to show:
  1. "📤 Publishing 3 drafts..."
  2. Progress updates as each publishes
  3. "✅ Published 3 posts to X!" with links

#### Scenario: Publish via command
**Given** user sends `/approve`
**When** there are approved drafts
**Then** a NEW message shows publishing progress and results

#### Scenario: No approved drafts
**Given** there are no approved drafts
**When** Approve is triggered
**Then** message shows "No approved drafts to publish. Approve some drafts first!"

---

### Requirement: Help Command
The bot MUST display usage instructions.

#### Scenario: View help via button
**Given** user clicks `❓ Help` button
**Then** the CURRENT message is EDITED to show help content

#### Scenario: View help via command
**Given** user sends `/help`
**Then** a NEW message shows help content

---

### Requirement: Schedule Command
The bot MUST allow scheduling posts for future publication.

#### Scenario: Schedule via button
**Given** user clicks `📅 Schedule` button
**Then** the CURRENT message is EDITED to prompt for SHA and datetime
**And** chat state is set to `awaiting_input: 'schedule'`

#### Scenario: User sends schedule input
**Given** user was prompted for schedule input
**When** user sends `abc123 2024-01-15 14:00`
**Then** a NEW message shows:
  1. "🔄 Generating content..."
  2. "📅 Scheduled for Jan 15, 2024 at 2:00 PM"

#### Scenario: Schedule via command
**Given** user sends `/schedule abc123 2024-01-15 14:00`
**Then** a NEW message shows scheduling progress and confirmation

#### Scenario: Scheduled post auto-publishes
**Given** a scheduled draft with due time
**When** cron runs
**Then** draft is published automatically
**And** user receives a notification message

---

### Requirement: Delete Command
The bot MUST allow finding and deleting posts by commit SHA.

#### Scenario: Delete via button
**Given** user clicks `🗑️ Delete` button
**Then** the CURRENT message is EDITED to prompt for SHA

#### Scenario: User sends SHA to delete
**Given** user was prompted for delete input
**When** user sends `abc123`
**Then** a NEW message shows matching posts with delete buttons

#### Scenario: Delete via command
**Given** user sends `/delete abc123`
**Then** a NEW message shows matching posts

#### Scenario: Confirm delete via button
**Given** user sees post list and clicks delete on one
**When** confirmed
**Then** the CURRENT message is EDITED to show "✅ Deleted tweet thread"

---

### Requirement: Slash Commands
All main actions MUST be accessible via slash commands.

#### Scenario: All slash commands send new messages
**Given** user sends any command: `/start`, `/generate`, `/approve`, `/drafts`, `/help`, `/schedule`, `/delete`
**When** processed
**Then** a NEW message is sent as the response
**And** this becomes the new dashboard message
