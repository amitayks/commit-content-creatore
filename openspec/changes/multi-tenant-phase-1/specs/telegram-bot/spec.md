## MODIFIED Requirements

### Requirement: Single-User Authorization
The webhook entry point SHALL authorize users by looking up their `chat_id` in the `users` table. Users with `status = 'active'` are authorized for all features. Users with `status = 'onboarding'` are redirected to the onboarding flow. Users with `status = 'suspended'` receive a suspension message. Unregistered users (no `users` row) enter the onboarding flow. The `isAdmin(chatId, env)` function (`String(chatId) === env.TELEGRAM_CHAT_ID`) is used only for admin-specific features (Video Studio, admin endpoints), not for general authorization.

#### Scenario: Active registered user sends a message
- **WHEN** a user with `status = 'active'` in the `users` table sends a message
- **THEN** the message is authorized and routed to handlers normally

#### Scenario: Unregistered user sends a message
- **WHEN** a user with no row in the `users` table sends any message
- **THEN** a `users` row is created with `status = 'onboarding'` and the onboarding flow begins

#### Scenario: Onboarding user sends a message
- **WHEN** a user with `status = 'onboarding'` sends a message
- **THEN** the message is routed to the onboarding handler at the user's current step

#### Scenario: Suspended user sends a message
- **WHEN** a user with `status = 'suspended'` sends a message
- **THEN** the bot responds with a suspension notice and does not process the message

### Requirement: Database-Level Ownership
All database tables (`drafts`, `repos`, `published`, `video_drafts`, `video_published`, `video_presets`, `twitter_accounts`, `twitter_tweets`, `users`) carry a `chat_id` column. All read and write operations SHALL filter by `chat_id` to ensure data isolation between users.

#### Scenario: User queries their drafts
- **WHEN** a user requests their drafts list
- **THEN** only drafts with matching `chat_id` are returned

#### Scenario: User cannot access another user's data
- **WHEN** a user's request is processed
- **THEN** all DB queries include `WHERE chat_id = ?` with the requesting user's chat_id
