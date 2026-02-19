## ADDED Requirements

### Requirement: Single batch notification per poll cycle
After scoring, the poller SHALL send ONE Telegram message per poll cycle listing all scored tweets (above threshold) and auto-approved drafts. If no tweets pass scoring, no message SHALL be sent.

#### Scenario: Multiple scored tweets
- **WHEN** 5 tweets score above threshold across 3 accounts
- **THEN** ONE Telegram message SHALL be sent listing all 5

#### Scenario: No tweets above threshold
- **WHEN** all tweets score below their account thresholds
- **THEN** no notification SHALL be sent

### Requirement: Batch notification format
Each item in the batch message SHALL show: `@username (star score/10)`, first 100 characters of tweet text (or thread summary), and inline buttons. The format SHALL be HTML with proper escaping.

#### Scenario: Scored tweet item
- **WHEN** a tweet from @vercel scores 9/10
- **THEN** the item SHALL display: `@vercel (⭐ 9/10)\n"Next.js 15.3 is here with React Comp..."\n[Generate] [Open Tweet ↗]`

#### Scenario: Auto-approved item
- **WHEN** an account has auto-approve and the tweet scores above threshold
- **THEN** the item SHALL display: `@anthropic (⭐ 9/10) ✅ Auto-approved\n"Claude 4.5 Opus now available..."\n[View Draft] [Open Tweet ↗]`

#### Scenario: Thread item
- **WHEN** a scored item is a thread (multiple tweets)
- **THEN** the display SHALL indicate it: `@vercel (⭐ 8/10) 🧵 Thread (4 tweets)\n"Starting today, Next.js supports..."`

### Requirement: Generate button creates draft and edits message
When the user clicks [Generate] on a batch item, the system SHALL: generate the repost draft via AI, create the draft in the DB, update the `twitter_tweets` row, and edit the batch Telegram message in-place to replace [Generate] with [View Draft] and show "✅ Draft created".

#### Scenario: Generate clicked
- **WHEN** user clicks [Generate] for tweet "123" in batch message
- **THEN** the system SHALL generate a draft, store it, and edit the batch message to show the updated state

#### Scenario: Generate callback format
- **WHEN** a Generate button is rendered
- **THEN** its `callback_data` SHALL be `action:tw_gen:TWEET_ID` (abbreviated to fit 64-byte limit)

### Requirement: Batch message ID tracking
Each `twitter_tweets` row that appears in a batch notification SHALL store the Telegram `batch_message_id` (the message_id returned from `sendMessage`). This enables the action handler to reconstruct and edit the correct message.

#### Scenario: Message ID stored
- **WHEN** a batch notification is sent and returns message_id 5432
- **THEN** all tweet rows in that batch SHALL have `batch_message_id=5432`

### Requirement: Open Tweet button
Each batch item SHALL have an [Open Tweet ↗] URL button that opens the original tweet in a browser. This SHALL use Telegram's URL button (not callback).

#### Scenario: Open Tweet button
- **WHEN** the batch notification is rendered
- **THEN** each item SHALL include `{ text: '🔗 Open', url: 'https://x.com/username/status/TWEET_ID' }`

### Requirement: Batch notification sent via poller worker
The batch notification SHALL be sent from the twitter-poller worker using the Telegram Bot API directly (`sendMessage` with `parse_mode: 'HTML'` and `inline_keyboard`). The poller SHALL use `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` from its env.

#### Scenario: Poller sends notification
- **WHEN** the polling cycle completes with scored tweets
- **THEN** the twitter-poller worker SHALL call the Telegram sendMessage API directly

### Requirement: Generate action handled by content-bot
The [Generate] button callback SHALL be handled by the existing content-bot worker (via Telegram webhook). The content-bot SHALL: look up the tweet from `twitter_tweets`, fetch account persona and history, call the generation prompt, create the draft, update the tweet row, and edit the batch message.

#### Scenario: Generate action routing
- **WHEN** user clicks [Generate] and the Telegram webhook fires
- **THEN** the content-bot router SHALL dispatch `action:tw_gen:TWEET_ID` to the generate handler
