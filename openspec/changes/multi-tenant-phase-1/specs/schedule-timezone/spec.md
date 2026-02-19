## MODIFIED Requirements

### Requirement: Timezone stored per user
The system SHALL store the timezone offset as a string in the `users` table `timezone` column (instead of `chat_state`), defaulting to `'UTC'`.

#### Scenario: New user has default timezone
- **WHEN** a new user completes onboarding
- **THEN** their `users.timezone` column is `'UTC'` by default

#### Scenario: Timezone read from users table
- **WHEN** `getTimezone(env, chatId)` is called
- **THEN** it reads from `users` table WHERE `chat_id = ?`, returning the `timezone` column value
