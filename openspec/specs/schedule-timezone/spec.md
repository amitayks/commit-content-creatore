### Requirement: Schedule input applies user timezone
When a user enters a schedule datetime, the system SHALL interpret it in the user's configured timezone and convert to UTC for storage.

#### Scenario: User in UTC+2 schedules a post
- **WHEN** user has timezone "UTC+2" and enters "2026-02-10 08:10"
- **THEN** the system stores `scheduled_at` as "2026-02-10 06:10:00" (UTC)

#### Scenario: User in UTC (default) schedules a post
- **WHEN** user has timezone "UTC" and enters "2026-02-10 08:10"
- **THEN** the system stores `scheduled_at` as "2026-02-10 08:10:00" (UTC)

#### Scenario: User in negative offset schedules a post
- **WHEN** user has timezone "UTC-5" and enters "2026-02-10 20:00"
- **THEN** the system stores `scheduled_at` as "2026-02-11 01:00:00" (UTC)

### Requirement: Scheduled time displayed in user timezone
When displaying a draft's scheduled time, the system SHALL convert from UTC to the user's timezone.

#### Scenario: Draft detail shows local scheduled time
- **WHEN** user has timezone "UTC+2" and draft has `scheduled_at` "2026-02-10 06:10:00"
- **THEN** the draft detail shows "Scheduled for 2026-02-10 at 08:10 (UTC+2)"

#### Scenario: Draft list shows local scheduled time
- **WHEN** user has timezone "UTC+3" and views scheduled drafts
- **THEN** all scheduled times are displayed in UTC+3

### Requirement: Schedule confirmation shows local time
After scheduling a draft, the confirmation message SHALL display the time in the user's timezone.

#### Scenario: Schedule confirmation with timezone
- **WHEN** user in "UTC+2" schedules a post for "2026-02-10 14:00"
- **THEN** the confirmation shows "Scheduled for 2026-02-10 at 14:00 (UTC+2)"

### Requirement: Cron publish notification shows local time
When a scheduled post is published by the cron job, the notification SHALL display the time in the user's timezone.

#### Scenario: Publish notification shows local time
- **WHEN** cron publishes a draft and the owner has timezone "UTC+2"
- **THEN** the notification shows the publish time in UTC+2

### Requirement: Past-time validation uses user timezone
The past-time check for schedule input SHALL compare against the current time in the user's timezone.

#### Scenario: User in UTC+2 checks for past time
- **WHEN** it is 10:00 UTC (12:00 local) and user in "UTC+2" enters "11:00"
- **THEN** the system rejects it as past (11:00 local < 12:00 local)

### Requirement: Timezone stored per user
The system SHALL store the timezone offset as a string in the `users` table `timezone` column (instead of `chat_state`), defaulting to `'UTC'`.

#### Scenario: New user has default timezone
- **WHEN** a new user completes onboarding
- **THEN** their `users.timezone` column is `'UTC'` by default

#### Scenario: Timezone read from users table
- **WHEN** `getTimezone(env, chatId)` is called
- **THEN** it reads from `users` table WHERE `chat_id = ?`, returning the `timezone` column value
