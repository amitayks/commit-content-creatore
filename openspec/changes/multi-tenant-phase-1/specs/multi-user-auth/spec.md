## ADDED Requirements

### Requirement: Authorization via users table
The system SHALL authorize users by looking up their `chat_id` in the `users` table and checking `status = 'active'`.

#### Scenario: Active user sends a command
- **WHEN** a user with `status = 'active'` in the `users` table sends a message
- **THEN** the user is authorized and the message is routed to handlers normally

#### Scenario: Suspended user sends a command
- **WHEN** a user with `status = 'suspended'` sends a message
- **THEN** the user is not authorized and receives a "your account is suspended" message

#### Scenario: Onboarding user sends a command
- **WHEN** a user with `status = 'onboarding'` sends a message
- **THEN** the user is redirected to the onboarding flow at their current step

#### Scenario: Unregistered user sends a message
- **WHEN** a user with no row in the `users` table sends a message
- **THEN** the user enters the onboarding flow (a new `users` row is created)

### Requirement: isAdmin helper function
The system SHALL provide an `isAdmin(chatId, env)` function that returns `true` if `String(chatId) === env.TELEGRAM_CHAT_ID`. This check does NOT require DB access.

#### Scenario: Admin user identified
- **WHEN** `isAdmin` is called with the chat_id matching `env.TELEGRAM_CHAT_ID`
- **THEN** it returns `true`

#### Scenario: Regular user not admin
- **WHEN** `isAdmin` is called with any other chat_id
- **THEN** it returns `false`

### Requirement: isAuthorized function checks users table
The system SHALL provide an `isAuthorized(chatId, env)` function that queries the `users` table. It returns `true` only if a row exists with matching `chat_id` and `status = 'active'`.

#### Scenario: User with active status
- **WHEN** `isAuthorized` is called for a user with `status = 'active'`
- **THEN** it returns `true`

#### Scenario: User not in table
- **WHEN** `isAuthorized` is called for a chat_id with no `users` row
- **THEN** it returns `false`

### Requirement: Admin endpoints unchanged
Admin endpoints (`/setup`, `/migrate`) SHALL continue to use the existing `ADMIN_SECRET` header verification. They are not affected by the new auth model.

#### Scenario: Admin endpoint access
- **WHEN** a request hits `/setup` with a valid `X-Admin-Secret` header
- **THEN** access is granted regardless of `users` table state
