## ADDED Requirements

### Requirement: Repost command and dashboard button
The system SHALL provide a `/repost` command and a "🔄 RePost" button on the home dashboard that enters the repost URL input mode.

#### Scenario: User triggers repost via command
- **WHEN** user sends `/repost`
- **THEN** bot sets `awaiting_input` to `repost_url` and displays a prompt: "Send me a tweet URL to create a repost" with a Cancel button

#### Scenario: User triggers repost via dashboard button
- **WHEN** user clicks "🔄 RePost" on the home screen
- **THEN** bot enters the same repost URL input mode as the `/repost` command

### Requirement: Tweet URL parsing
The system SHALL parse tweet URLs to extract the tweet ID and username. Supported formats: `https://x.com/{username}/status/{id}`, `https://twitter.com/{username}/status/{id}`, and bare variants without protocol.

#### Scenario: Valid tweet URL
- **WHEN** user sends a valid tweet URL like `https://x.com/vercel/status/1234567890`
- **THEN** bot extracts username `vercel` and tweet ID `1234567890` and proceeds to fetch the tweet

#### Scenario: Invalid URL format
- **WHEN** user sends text that is not a recognized tweet URL
- **THEN** bot displays an error message with format examples and keeps `awaiting_input` as `repost_url`

### Requirement: Tweet preview with engagement metrics
The system SHALL fetch the tweet via X API and display a preview before generating, including: author name/username, tweet text (truncated if long), engagement metrics (likes, retweets, quotes), thread indicator if applicable.

#### Scenario: Standalone tweet preview
- **WHEN** bot fetches a standalone tweet successfully
- **THEN** bot displays preview with author info, tweet text, metrics, and action buttons: tone selector row, [Generate] button, [Cancel] button

#### Scenario: Thread tweet preview
- **WHEN** bot fetches a tweet that is part of a thread (self-reply chain)
- **THEN** bot displays preview indicating "Thread (N tweets)" and fetches the full thread text for context

#### Scenario: Tweet fetch fails
- **WHEN** X API returns an error or the tweet doesn't exist
- **THEN** bot displays "Tweet not found or inaccessible" with a retry prompt

### Requirement: Duplicate detection
The system SHALL check if a repost draft or published post already exists for the given tweet ID before generating.

#### Scenario: Existing draft found
- **WHEN** user submits a URL for a tweet that already has a repost draft
- **THEN** bot warns "You already have a repost draft for this tweet" and offers [View Existing Draft] and [Generate Anyway] buttons

#### Scenario: No duplicate found
- **WHEN** user submits a URL for a tweet with no existing repost
- **THEN** bot proceeds to the preview step normally

### Requirement: Tone selection in preview
The system SHALL display tone selector buttons in the preview step. Available tones: professional, casual, analytical, enthusiastic, witty, sarcastic. The currently selected tone SHALL be visually indicated.

#### Scenario: User selects tone before generating
- **WHEN** user taps a tone button in the preview
- **THEN** the preview message updates with the new tone highlighted, and the selected tone is used for generation

#### Scenario: Default tone for followed accounts
- **WHEN** the tweet is from a followed account
- **THEN** the default tone in the preview is set to that account's configured tone

#### Scenario: Default tone for unknown accounts
- **WHEN** the tweet is from an account not being followed
- **THEN** the default tone is "professional"

### Requirement: AI generation with context
The system SHALL generate a quote-tweet draft using the repost generation prompt, with context including: the tweet text (full thread if applicable), author profile info, persona overview (from account or persona cache), and the selected tone.

#### Scenario: Generation for followed account
- **WHEN** user clicks Generate for a tweet from a followed account
- **THEN** bot uses the stored persona overview and account config, generates content, creates a draft with source='repost', and shows the draft detail with image

#### Scenario: Generation for unknown account
- **WHEN** user clicks Generate for a tweet from an account not being followed
- **THEN** bot fetches/creates persona via X API profile + Gemini web search, caches it, generates content using DEFAULT config (with selected tone override), and shows draft detail

### Requirement: Follow prompt after generation
The system SHALL offer to follow an unknown account after successfully generating a repost draft.

#### Scenario: Prompt to follow unknown account
- **WHEN** a repost draft is successfully generated for a tweet from an account the user does not follow
- **THEN** bot sends a separate message: "Want to follow @username for automatic reposts?" with [Follow] and [No thanks] buttons

#### Scenario: User clicks Follow
- **WHEN** user clicks Follow on the prompt
- **THEN** the account is added to followed accounts (same as addAccountAction) and a confirmation is shown

#### Scenario: User clicks No thanks
- **WHEN** user clicks No thanks
- **THEN** the prompt message is edited to "Got it! You can always follow them later from Accounts."
