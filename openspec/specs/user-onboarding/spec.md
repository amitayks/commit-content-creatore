## ADDED Requirements

### Requirement: Onboarding trigger for unregistered users
Any message from an unregistered user (no row in `users` table) SHALL create a `users` row with `status = 'onboarding'` and present the welcome screen.

#### Scenario: New user sends /start
- **WHEN** an unregistered user sends `/start`
- **THEN** a `users` row is created with `status = 'onboarding'` and `onboarding_step = 'welcome'`, and the welcome message is displayed

#### Scenario: New user sends any message
- **WHEN** an unregistered user sends any message (not just /start)
- **THEN** the user enters the onboarding flow the same as if they sent /start

### Requirement: Welcome screen with Get Started
The welcome screen SHALL display a greeting, brief description of Muse, and two buttons: "Get Started" and "Learn More".

#### Scenario: User clicks Get Started
- **WHEN** user clicks "Get Started" on the welcome screen
- **THEN** the onboarding advances to `onboarding_step = 'gemini_key'` and the Gemini key prompt is shown

#### Scenario: User clicks Learn More
- **WHEN** user clicks "Learn More"
- **THEN** the bot displays a description of features and a "Get Started" button

### Requirement: Step 1 — Gemini API key (required)
The system SHALL prompt for a Google Gemini API key with instructions on how to obtain one. The user sends their key as a plain text message.

#### Scenario: User provides valid Gemini key
- **WHEN** user sends a text message during `onboarding_step = 'gemini_key'`
- **THEN** the message is deleted from Telegram, the key is encrypted and stored in `users.gemini_key_enc`, a test API call validates the key, `has_gemini` is set to 1, and onboarding advances to `onboarding_step = 'x_keys'`

#### Scenario: Gemini key validation fails
- **WHEN** the test API call with the provided Gemini key fails
- **THEN** the encrypted key is removed, an error message is shown with guidance, and the user can retry without restarting

#### Scenario: User clicks Skip on Gemini step
- **WHEN** user clicks "Skip for now" on the Gemini key step
- **THEN** onboarding advances to the next step without storing a key, `has_gemini` remains 0

### Requirement: Step 2 — X/Twitter API keys (required)
The system SHALL prompt for 4 X API values (API_KEY, API_SECRET, ACCESS_TOKEN, ACCESS_SECRET) sent as a single message with one value per line.

#### Scenario: User provides valid X keys
- **WHEN** user sends a 4-line message during `onboarding_step = 'x_keys'`
- **THEN** the message is deleted, all 4 values are encrypted and stored separately, a `verifyCredentials()` test call validates them, `has_x` is set to 1, and onboarding advances to `onboarding_step = 'github_token'`

#### Scenario: X key message has wrong number of lines
- **WHEN** user sends a message with fewer or more than 4 lines during `onboarding_step = 'x_keys'`
- **THEN** an error message is shown explaining the expected format, and the user can retry

#### Scenario: X key validation fails
- **WHEN** the `verifyCredentials()` test call fails
- **THEN** the encrypted keys are removed, an error message is shown, and the user can retry

#### Scenario: User clicks Skip on X step
- **WHEN** user clicks "Skip for now" on the X keys step
- **THEN** onboarding advances to the next step without storing keys, `has_x` remains 0

### Requirement: Step 3 — GitHub token (optional)
The system SHALL prompt for a GitHub personal access token with instructions. This step is explicitly optional.

#### Scenario: User provides valid GitHub token
- **WHEN** user sends a text message during `onboarding_step = 'github_token'`
- **THEN** the message is deleted, the token is encrypted and stored, a `GET /user` test call validates it, `has_github` is set to 1, and onboarding advances to completion

#### Scenario: User skips GitHub token
- **WHEN** user clicks "Skip" on the GitHub token step
- **THEN** onboarding advances to completion without storing a token, `has_github` remains 0

### Requirement: Onboarding completion
When all steps are done, the system SHALL set `status = 'active'`, clear `onboarding_step`, and display a completion summary showing which services are connected.

#### Scenario: User completes all steps
- **WHEN** the final onboarding step is completed or skipped
- **THEN** `users.status` is set to `'active'`, `onboarding_step` is set to null, and a summary screen shows connected/skipped services with "Dashboard" and "Add More Keys" buttons

### Requirement: Onboarding resumes on return
If a user leaves mid-onboarding and returns later, the system SHALL resume from their current `onboarding_step`.

#### Scenario: User returns after leaving mid-onboarding
- **WHEN** a user with `status = 'onboarding'` sends any message
- **THEN** the bot shows the prompt for their current `onboarding_step`

### Requirement: Immediate message deletion for security
The system SHALL call Telegram's `deleteMessage` API immediately after receiving a message containing an API key, before validation.

#### Scenario: Key message deleted from chat
- **WHEN** user sends a message containing an API key during onboarding
- **THEN** the Telegram message is deleted from the chat before any validation occurs

### Requirement: Max users cap
The system SHALL check the total number of users during onboarding against `MAX_USERS` env var (default 50).

#### Scenario: User tries to register when at capacity
- **WHEN** an unregistered user sends a message and the `users` table has reached `MAX_USERS` count
- **THEN** the bot responds with "Bot is at capacity" and does not create a user row
