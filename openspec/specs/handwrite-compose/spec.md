## ADDED Requirements

### Requirement: Handwrite compose mode lifecycle
The system SHALL provide a compose mode where users write their own tweets via sequential Telegram messages. The mode is entered via `/handwrite` command or dashboard button, accumulates messages as tweets, and exits on "Pen Down" or cancel.

#### Scenario: Enter compose via slash command
- **WHEN** user sends `/handwrite`
- **THEN** the bot SHALL send a new message "✍️ Composing... (0 tweets)\nSend your tweets below. Each message = one tweet." with Pen Down, Image Gen toggle, AI Refine toggle, and Cancel buttons
- **AND** `awaiting_input` SHALL be set to `'handwrite'`
- **AND** the status message ID SHALL be stored in `HandwriteState.statusMessageId`

#### Scenario: Enter compose via dashboard button
- **WHEN** user clicks the "Handwrite" button on the dashboard
- **THEN** the dashboard message SHALL be edited to show the compose prompt with the same buttons
- **AND** `awaiting_input` SHALL be set to `'handwrite'`

### Requirement: Multi-message tweet accumulation
While in compose mode (`awaiting_input === 'handwrite'`), each text message the user sends SHALL be buffered as a separate tweet in chronological order.

#### Scenario: Text message becomes tweet
- **WHEN** user sends a text message while in compose mode
- **THEN** the message text SHALL be appended to `HandwriteState.tweets[]` with the Telegram `message_id` stored
- **AND** the bot's status message SHALL be edited to update the tweet count

#### Scenario: Status message counter update
- **WHEN** a new tweet is buffered
- **THEN** the bot SHALL edit its status message to show "✍️ Composing... (N tweets)" where N is the current buffer size
- **AND** if any tweet exceeds 280 characters, the status SHALL include "⚠️ Tweet K over 280 chars"

#### Scenario: Photo message becomes tweet with media
- **WHEN** user sends a photo message (with optional caption) while in compose mode
- **THEN** the photo SHALL be downloaded from Telegram and stored in R2
- **AND** a tweet SHALL be buffered with the caption as text (or empty string if no caption) and the R2 key as `mediaKey`
- **AND** the status message counter SHALL update

### Requirement: Native message editing updates buffer
The system SHALL handle `edited_message` Telegram updates to update previously buffered tweets during compose mode.

#### Scenario: User edits a text message
- **WHEN** user edits a previously sent message while in compose mode
- **THEN** the bot SHALL receive an `edited_message` update
- **AND** the bot SHALL find the matching tweet by `messageId` in the buffer and replace its text
- **AND** the status message counter SHALL update (character warnings may change)

#### Scenario: User edits a photo caption
- **WHEN** user edits the caption of a photo message while in compose mode
- **THEN** the bot SHALL update the matching tweet's text in the buffer
- **AND** the media reference SHALL remain unchanged

#### Scenario: Edit outside compose mode ignored
- **WHEN** an `edited_message` update arrives and the chat is NOT in compose mode
- **THEN** the update SHALL be silently ignored

### Requirement: Compose mode toggle buttons
The compose status message SHALL include toggle buttons for Image Generation and AI Refine that persist their state in `HandwriteState`.

#### Scenario: Toggle image generation on
- **WHEN** user clicks the "🎨 Image: OFF" button
- **THEN** `HandwriteState.imageGen` SHALL be set to `true`
- **AND** the button text SHALL change to "🎨 Image: ON"
- **AND** the status message SHALL be re-rendered with updated button

#### Scenario: Toggle AI refine on
- **WHEN** user clicks the "✨ AI: OFF" button
- **THEN** `HandwriteState.aiRefine` SHALL be set to `true`
- **AND** the button text SHALL change to "✨ AI: ON"

### Requirement: Pen Down finalizes compose and creates draft
When the user clicks "Pen Down", the compose session SHALL end and a draft SHALL be created from the buffered tweets.

#### Scenario: Pen down with tweets and no AI
- **WHEN** user clicks "✏️ Pen Down" with tweets buffered and both toggles OFF
- **THEN** a draft SHALL be created with `source: 'handwrite'`, `pr_number: 0`, `pr_title` as the first tweet text (truncated to 100 chars), and `DraftContent` with the buffered tweets
- **AND** `format` SHALL be `'single'` if 1 tweet, `'thread'` if 2+ tweets
- **AND** `awaiting_input` SHALL be cleared
- **AND** the user SHALL see `renderDraftDetail()` for the new draft

#### Scenario: Pen down with AI refine enabled
- **WHEN** user clicks "Pen Down" with `aiRefine: true`
- **THEN** the bot SHALL send the tweets to Gemini for refinement (polish grammar, clarity, impact — preserve voice, tweet count, and order)
- **AND** the refined tweets SHALL be used in the draft content
- **AND** the original tweets SHALL be discarded (the refined version is the draft)

#### Scenario: Pen down with image generation enabled
- **WHEN** user clicks "Pen Down" with `imageGen: true`
- **THEN** the bot SHALL send the tweets to Gemini to generate an `imagePrompt`
- **AND** the `imagePrompt` SHALL be stored in the `DraftContent`
- **AND** image generation from the prompt happens on-demand when viewing the draft (existing flow)

#### Scenario: Pen down with both toggles enabled
- **WHEN** user clicks "Pen Down" with both `aiRefine: true` and `imageGen: true`
- **THEN** both AI refinement and image prompt generation SHALL be requested from Gemini in a single call
- **AND** the draft SHALL contain refined tweets and an imagePrompt

#### Scenario: Pen down with no tweets
- **WHEN** user clicks "Pen Down" with zero tweets buffered
- **THEN** the bot SHALL show an error "No tweets to save" and remain in compose mode

### Requirement: Cancel discards compose session
The cancel button SHALL discard the buffer and return to the dashboard.

#### Scenario: Cancel compose
- **WHEN** user clicks "❌ Cancel" on the compose status message
- **THEN** `awaiting_input` SHALL be cleared
- **AND** `HandwriteState` SHALL be cleared from context
- **AND** the user SHALL see the dashboard (`renderHome()`)
- **AND** any R2 media stored during the session SHALL remain (orphan cleanup is deferred)

### Requirement: Slash commands exit compose mode
Recognized slash commands typed during compose mode SHALL cancel the session and execute the command.

#### Scenario: Recognized command during compose
- **WHEN** user sends `/drafts` while in compose mode
- **THEN** the compose session SHALL be cancelled (buffer discarded, state cleared)
- **AND** the `/drafts` command SHALL execute normally

#### Scenario: Unrecognized slash text treated as tweet
- **WHEN** user sends `/something` that is not a registered command while in compose mode
- **THEN** the text SHALL be buffered as a tweet (not treated as a command)

### Requirement: HandwriteState type definition
The system SHALL define `HandwriteState` and `HandwriteTweet` types for the compose buffer.

#### Scenario: HandwriteState stored in ChatContext
- **WHEN** compose mode is active
- **THEN** `ChatContext` SHALL contain `awaiting_input: 'handwrite'` and `handwrite: HandwriteState`
- **AND** `HandwriteState` SHALL have fields: `tweets: HandwriteTweet[]`, `imageGen: boolean`, `aiRefine: boolean`, `statusMessageId: number`
- **AND** `HandwriteTweet` SHALL have fields: `messageId: number`, `text: string`, optional `mediaKey: string`, optional `mediaType: 'photo'`
