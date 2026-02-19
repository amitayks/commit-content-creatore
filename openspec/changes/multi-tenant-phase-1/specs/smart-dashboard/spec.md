## MODIFIED Requirements

### Requirement: Dashboard buttons include dynamic navigation
The dashboard SHALL conditionally show the Video Studio button based on admin status.
- Always show: Handwrite, Generate, Drafts, Repos, Accounts, Settings, Help
- Show Video Studio button ONLY when `isAdmin(chatId, env)` returns true
- Scheduled posts exist: show "View Schedule" button
- No scheduled posts: omit "View Schedule" button

#### Scenario: Admin views dashboard
- **WHEN** admin user views the home dashboard
- **THEN** the Video Studio button is displayed alongside all standard buttons

#### Scenario: Regular user views dashboard
- **WHEN** a non-admin user views the home dashboard
- **THEN** the Video Studio button is NOT displayed, all standard buttons are shown

### Requirement: Dashboard is async with DB access
`renderHome(env, chatId)` SHALL accept an additional `isAdmin` boolean parameter (or resolve it internally) to conditionally render the Video Studio button.

#### Scenario: Dashboard renders for admin
- **WHEN** `renderHome` is called with admin user's chatId
- **THEN** the rendered buttons include Video Studio

#### Scenario: Dashboard renders for regular user
- **WHEN** `renderHome` is called with a non-admin user's chatId
- **THEN** the rendered buttons do NOT include Video Studio
