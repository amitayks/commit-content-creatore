## MODIFIED Requirements

### Requirement: Cron publish notifications use record's chat_id
The cron handler SHALL send publish notifications (success, failure, stale video alerts) to the `chat_id` from each record (`draft.chat_id`, `video_draft.chat_id`), NOT to `env.TELEGRAM_CHAT_ID`.

#### Scenario: Scheduled draft published via cron
- **WHEN** cron publishes a scheduled draft belonging to user A
- **THEN** the success notification is sent to user A's `chat_id`, not to the admin's `env.TELEGRAM_CHAT_ID`

#### Scenario: Stale video generation detected
- **WHEN** cron detects a stale video generation for user B
- **THEN** the alert is sent to user B's `chat_id`

#### Scenario: Cron error for specific draft
- **WHEN** cron fails to publish a scheduled draft for user C
- **THEN** the error notification is sent to user C's `chat_id`
