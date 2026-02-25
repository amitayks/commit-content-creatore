## ADDED Requirements

### Requirement: Day picker inline buttons for scheduling
When a user initiates scheduling for any draft type, the system SHALL display inline buttons for the next 7 days in the user's configured timezone. Each button SHALL show the day name and date (e.g., "Thu 20/02", "Fri 21/02").

#### Scenario: Schedule initiated
- **WHEN** user clicks Schedule on any draft (auto, handwrite, or repost)
- **THEN** the system SHALL show 7 day buttons based on user's timezone, starting from today

#### Scenario: Day button format
- **WHEN** today is Thursday Feb 20, 2026 in UTC+2
- **THEN** buttons SHALL be: "Thu 20/02", "Fri 21/02", "Sat 22/02", "Sun 23/02", "Mon 24/02", "Tue 25/02", "Wed 26/02"

#### Scenario: Day button callback format
- **WHEN** a day button is rendered
- **THEN** its `callback_data` SHALL be `action:sched_day:DRAFT_ID:YYYY-MM-DD`

### Requirement: Time input after day selection
After selecting a day, the system SHALL prompt the user to send the time as text in HH:MM format (24-hour). The prompt SHALL show the selected day and the user's timezone.

#### Scenario: Day selected
- **WHEN** user clicks "Fri 21/02"
- **THEN** the system SHALL display: "📅 Scheduling for Fri 21/02\n\nSend the time in HH:MM format (24h)\nTimezone: UTC+2"
- **AND** the chat state SHALL be set to `awaiting_input: 'schedule_time'` with the selected date and draft ID in context

#### Scenario: Valid time input
- **WHEN** user sends "14:30" after selecting Fri 21/02 in UTC+2
- **THEN** the system SHALL combine to "2026-02-21 14:30" in UTC+2, convert to UTC ("2026-02-21 12:30"), and schedule the draft

#### Scenario: Invalid time input
- **WHEN** user sends "25:00" or "abc"
- **THEN** the system SHALL respond with an error and re-prompt for valid HH:MM

#### Scenario: Past time validation
- **WHEN** user selects today's date and enters a time that has already passed in their timezone
- **THEN** the system SHALL reject with "This time has already passed. Please choose a later time."

### Requirement: Cancel button during scheduling
The day picker and time prompt views SHALL include a Cancel button that returns to the draft detail view without scheduling.

#### Scenario: Cancel from day picker
- **WHEN** user clicks Cancel on the day picker
- **THEN** the system SHALL return to the draft detail view

#### Scenario: Cancel from time prompt
- **WHEN** user clicks Cancel during time input
- **THEN** the system SHALL return to the draft detail view
