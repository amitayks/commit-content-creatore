### Requirement: Settings button on dashboard
The home dashboard SHALL include a "Settings" button that navigates to the settings view.

#### Scenario: User opens settings from dashboard
- **WHEN** user clicks the "Settings" button on the home dashboard
- **THEN** the bot displays the settings view showing current timezone

### Requirement: Settings view displays current timezone
The settings view SHALL display the user's current timezone, page size, and API key connection status. It SHALL NOT display video settings (those are in Video Studio). It SHALL include an API Keys management section.

#### Scenario: User views settings
- **WHEN** user opens settings
- **THEN** the view shows timezone, page size, API Keys section, and a Home button. No video settings button is shown.

#### Scenario: User views API Keys section
- **WHEN** user navigates to API Keys in settings
- **THEN** each service (Gemini, X/Twitter, GitHub, HeyGen) shows connected/disconnected status with Update or Connect buttons

### Requirement: Timezone selection via presets
When the user clicks "Change Timezone", the bot SHALL present common UTC offset presets as buttons plus an option to type a custom offset.

#### Scenario: User selects a preset timezone
- **WHEN** user clicks "UTC+2" from the preset buttons
- **THEN** the timezone is saved and the settings view refreshes showing "Timezone: UTC+2"

#### Scenario: User types a custom timezone offset
- **WHEN** user is prompted for timezone and types "UTC+5:30"
- **THEN** the timezone is saved and the settings view refreshes showing "Timezone: UTC+5:30"

#### Scenario: User enters invalid timezone format
- **WHEN** user types "Europe/London" or "xyz"
- **THEN** the bot shows an error with format guidance and lets the user retry

### Requirement: Timezone stored per user
The system SHALL store the timezone offset in the `users` table `timezone` column, defaulting to `'UTC'`.

#### Scenario: New user has default timezone
- **WHEN** a new user completes onboarding
- **THEN** their timezone is `'UTC'` by default in the `users` table

### Requirement: Back navigation from settings
The settings view SHALL include a "Back" button returning to the home dashboard.

#### Scenario: User navigates back from settings
- **WHEN** user clicks "Back" on the settings view
- **THEN** the bot returns to the home dashboard

### Requirement: API Keys management in settings
The settings view SHALL include an API Keys section showing connection status for each service (Gemini, X/Twitter, GitHub, HeyGen). Connected services show a checkmark and an "Update" button. Disconnected services show an empty indicator and a "Connect" button.

#### Scenario: User with all keys connected
- **WHEN** user opens API Keys settings and has Gemini, X, GitHub, and HeyGen keys stored
- **THEN** all four services show as connected with "Update" buttons

#### Scenario: User with partial keys
- **WHEN** user opens API Keys settings and has only Gemini and X keys
- **THEN** Gemini and X show as connected, GitHub and HeyGen show as disconnected with "Connect" buttons

### Requirement: Update existing API key
When a user clicks "Update" on a connected service, the system SHALL prompt for a new key, encrypt and store it (replacing the old one), delete the Telegram message, and validate the new key.

#### Scenario: User updates Gemini key
- **WHEN** user clicks "Update" on Gemini and sends a new key
- **THEN** the message is deleted, the new key is encrypted and replaces the old one, and a validation test runs

#### Scenario: Key update validation fails
- **WHEN** user provides an invalid key during update
- **THEN** the old key is preserved, an error is shown, and the user can retry

### Requirement: Connect new API key
When a user clicks "Connect" on a disconnected service, the system SHALL prompt for the key with instructions, following the same flow as onboarding (encrypt, delete message, validate).

#### Scenario: User connects GitHub token after onboarding
- **WHEN** user clicks "Connect" on GitHub in settings and sends a valid token
- **THEN** the token is encrypted, stored, validated, `has_github` set to 1, and settings view refreshes
