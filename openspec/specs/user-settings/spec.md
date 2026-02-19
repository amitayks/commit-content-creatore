## ADDED Requirements

### Requirement: Settings button on dashboard
The home dashboard SHALL include a "Settings" button that navigates to the settings view.

#### Scenario: User opens settings from dashboard
- **WHEN** user clicks the "Settings" button on the home dashboard
- **THEN** the bot displays the settings view showing current timezone

### Requirement: Settings view displays current timezone
The settings view SHALL display the user's current timezone offset and provide a button to change it.

#### Scenario: User views settings with default timezone
- **WHEN** user opens settings and has not configured a timezone
- **THEN** the view shows "Timezone: UTC (default)" with a "Change Timezone" button

#### Scenario: User views settings with configured timezone
- **WHEN** user opens settings and has timezone set to "UTC+2"
- **THEN** the view shows "Timezone: UTC+2" with a "Change Timezone" button

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
The system SHALL store the timezone offset as a string in the `chat_state` table, defaulting to `'UTC'`.

#### Scenario: New user has default timezone
- **WHEN** a new user starts the bot
- **THEN** their timezone is `'UTC'` by default

### Requirement: Back navigation from settings
The settings view SHALL include a "Back" button returning to the home dashboard.

#### Scenario: User navigates back from settings
- **WHEN** user clicks "Back" on the settings view
- **THEN** the bot returns to the home dashboard
