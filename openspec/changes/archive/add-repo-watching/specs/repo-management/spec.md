# Repo Management Capability

## Overview
Manage watched repositories via the Telegram bot interface. Users can add, remove, and configure repos for auto-detection.

## ADDED Requirements

### Requirement: Add Watched Repository
Users can add a repository to be watched for auto-detection.

#### Scenario: Add repo via command
- **Given**: User is in any bot view
- **When**: User sends `/watch owner/repo`
- **Then**: Bot validates the repo exists on GitHub
- **And**: Creates a webhook on the repo
- **And**: Saves the repo to the database
- **And**: Responds with success message

#### Scenario: Add repo via button flow
- **Given**: User is on the repos list view
- **When**: User clicks "➕ Add repo"
- **Then**: Bot prompts for repo name
- **When**: User sends `owner/repo`
- **Then**: Bot adds the repo and shows detail view

#### Scenario: Add invalid repo
- **Given**: User is adding a repo
- **When**: User sends an invalid repo name
- **Then**: Bot shows error message with correct format example

---

### Requirement: View Watched Repositories
Users can view all their watched repositories.

#### Scenario: View repos list
- **Given**: User clicks "📦 Repos" on home
- **When**: User has watched repos
- **Then**: Bot shows list of repos as buttons
- **And**: Each button shows repo name with watch status icon
- **And**: "➕ Add repo" button appears at top

#### Scenario: View empty repos list
- **Given**: User clicks "📦 Repos" on home
- **When**: User has no watched repos
- **Then**: Bot shows empty state with "➕ Add repo" button

---

### Requirement: View Repository Detail
Users can view details and manage individual repos.

#### Scenario: View repo detail
- **Given**: User is on repos list
- **When**: User clicks on a repo button
- **Then**: Bot shows repo detail with:
  - Repo name and owner
  - Current watching status
  - Configuration summary
  - Action buttons

---

### Requirement: Toggle Repository Watching
Users can enable/disable watching for a repo without deleting it.

#### Scenario: Stop watching
- **Given**: User is viewing a repo that is being watched
- **When**: User clicks "👁 Stop watching"
- **Then**: Webhook events for this repo are ignored
- **And**: Button updates to "👁 Start watching"

#### Scenario: Resume watching
- **Given**: User is viewing a repo that is paused
- **When**: User clicks "👁 Start watching"
- **Then**: Webhook events for this repo are processed
- **And**: Button updates to "👁 Stop watching"

---

### Requirement: Delete Repository
Users can completely remove a repo from watching.

#### Scenario: Delete repo
- **Given**: User is viewing repo detail
- **When**: User clicks "🗑 Delete"
- **Then**: Bot asks for confirmation
- **When**: User confirms
- **Then**: Webhook is removed from GitHub
- **And**: Repo is deleted from database
- **And**: User is returned to repos list

---

### Requirement: Home Dashboard Shows Repos Button
The home dashboard includes quick access to repo management.

#### Scenario: Repos button on home
- **Given**: User sends `/start`
- **When**: Bot shows home dashboard
- **Then**: "📦 Repos" button appears in the button grid
