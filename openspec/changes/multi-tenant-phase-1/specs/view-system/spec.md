## MODIFIED Requirements

### Requirement: Draft categories view
The home dashboard SHALL conditionally render the Video Studio button. It is shown ONLY when `isAdmin(chatId, env)` returns true. All other buttons (Handwrite, Generate, Drafts, Repos, Accounts, Settings, Help) are shown to all users.

#### Scenario: Admin user views home
- **WHEN** an admin user views the home dashboard
- **THEN** the Video Studio button is displayed alongside all other buttons

#### Scenario: Regular user views home
- **WHEN** a non-admin user views the home dashboard
- **THEN** the Video Studio button is NOT displayed, all other buttons are shown

## ADDED Requirements

### Requirement: Video Studio home includes Video Settings button
The Video Studio home screen SHALL include a "Video Settings" button that navigates to the video settings sub-section (characters, defaults, HeyGen account, Instagram).

#### Scenario: Admin opens Video Studio
- **WHEN** admin navigates to Video Studio home
- **THEN** the screen shows the repo list, Standalone Video button, AND a "Video Settings" button

### Requirement: Safety check on video_studio view
The `view:video_studio` handler SHALL check `isAdmin(chatId, env)` and return a "not available" message if the requesting user is not admin.

#### Scenario: Non-admin triggers video_studio view
- **WHEN** a non-admin user somehow triggers `view:video_studio` callback
- **THEN** the bot responds with "This feature is not available" and does not render Video Studio
