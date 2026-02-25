## Trigger & Input

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

## Persona

### Requirement: Persona cache table
The system SHALL maintain a `persona_cache` table for storing persona data of non-followed accounts. Columns: id (PK), username (UNIQUE), user_id, display_name, bio, persona, topics, created_at, updated_at.

#### Scenario: Cache entry created after manual repost
- **WHEN** a manual repost is generated for an unknown account
- **THEN** the fetched profile + AI-generated persona is stored in `persona_cache` keyed by username

#### Scenario: Cache entry reused on subsequent repost
- **WHEN** user generates a manual repost for an account that has a cache entry less than 30 days old
- **THEN** the cached persona is used without making new API/AI calls

### Requirement: Persona cache TTL
The system SHALL treat persona cache entries older than 30 days as stale and refresh them on next use.

#### Scenario: Stale cache entry
- **WHEN** a manual repost targets an account whose cache entry is older than 30 days
- **THEN** the system fetches fresh profile data and regenerates the persona, updating the cache entry

#### Scenario: Fresh cache entry
- **WHEN** a manual repost targets an account whose cache entry is less than 30 days old
- **THEN** the cached data is used as-is

### Requirement: Persona generation for unknown accounts
The system SHALL generate a lightweight persona for unknown accounts using: X API profile data (name, bio, description, public metrics) and Gemini with web search grounding for contextual understanding.

#### Scenario: Successful persona generation
- **WHEN** the system generates a persona for an unknown account
- **THEN** it fetches the user profile via X API, calls Gemini with web search grounding to understand who this person/company is, and stores the result in persona_cache

#### Scenario: X API profile fetch fails
- **WHEN** the X API profile lookup fails for an unknown account
- **THEN** generation proceeds with only the tweet text as context (no persona), and no cache entry is created

### Requirement: Followed accounts bypass cache
The system SHALL prefer `twitter_account_overviews` (from followed accounts) over `persona_cache` when both exist.

#### Scenario: Account is followed and has overview
- **WHEN** a manual repost targets an account that is being followed and has a persona overview
- **THEN** the system uses the `twitter_account_overviews` data, not `persona_cache`

#### Scenario: Account is followed but has no overview
- **WHEN** a manual repost targets a followed account without a persona overview
- **THEN** the system falls back to `persona_cache` if available, otherwise generates a new persona and caches it

### Requirement: Persona bootstrap with Gemini web search
The system SHALL provide a function to bootstrap an account persona overview by: fetching the X profile data (bio, name, followers), fetching recent tweets (up to 50), and calling Gemini with web search grounding enabled to research the person/company and generate a structured persona. The result SHALL be stored in `twitter_account_overviews`.

#### Scenario: Bootstrap corporate account
- **WHEN** bootstrap is triggered for @anthropic
- **THEN** Gemini SHALL search the web for "Anthropic", combine with X profile data and recent tweets, and generate persona fields: persona summary, topics array, communication style, notable context, recent themes

#### Scenario: Bootstrap individual developer
- **WHEN** bootstrap is triggered for @somedev
- **THEN** Gemini SHALL use X profile + recent tweets (web search may not find much), and generate persona based primarily on their tweet history

## Media Analysis

### Requirement: Store media URL at poll time
The system SHALL store the first relevant media URL (photo URL or video thumbnail) for each tweet in the `twitter_tweets.media_url` column when polling followed accounts.

#### Scenario: Tweet with photo
- **WHEN** the poller fetches a tweet that has an attached photo
- **THEN** the system stores the photo's `url` field as `media_url` in `twitter_tweets`

#### Scenario: Tweet with video
- **WHEN** the poller fetches a tweet that has an attached video or animated GIF
- **THEN** the system stores the video's `preview_image_url` (thumbnail) as `media_url` in `twitter_tweets`

#### Scenario: Tweet with no media
- **WHEN** the poller fetches a tweet with no media attachments
- **THEN** the `media_url` column SHALL be NULL

#### Scenario: Tweet with multiple media
- **WHEN** the poller fetches a tweet with multiple media attachments
- **THEN** the system stores only the first photo URL (or first video thumbnail if no photos)

### Requirement: X API media expansions in poller
The poller's `getUserTweets` call SHALL request media expansions (`attachments.media_keys`) with `media.fields` including `media_key,type,url,preview_image_url` to receive media metadata alongside tweet data.

#### Scenario: API request includes media fields
- **WHEN** the poller calls `getUserTweets` for a followed account
- **THEN** the request includes `attachments` in `tweet.fields`, `attachments.media_keys` in `expansions`, and `media_key,type,url,preview_image_url` in `media.fields`

### Requirement: Multimodal repost generation
When `analyzeMedia` is enabled and a tweet has a `media_url`, the repost generation flow SHALL fetch the image, base64-encode it, and send it as an `inline_data` part alongside the text prompt to Gemini.

#### Scenario: Generation with media enabled and image available
- **WHEN** generating a repost for a tweet that has `media_url` AND `analyzeMedia` is true
- **THEN** the system fetches the image, base64-encodes it, and includes it as a multimodal part in the Gemini API call

#### Scenario: Generation with media enabled but image fetch fails
- **WHEN** generating a repost for a tweet that has `media_url` AND the image fetch fails
- **THEN** the system continues generation with text-only (graceful fallback)

#### Scenario: Generation with media disabled
- **WHEN** generating a repost for a tweet that has `media_url` AND `analyzeMedia` is false
- **THEN** the system generates text-only, ignoring the media

#### Scenario: Manual repost always includes media
- **WHEN** generating via manual `/repost` flow AND the tweet has media
- **THEN** media is always included regardless of account config (no toggle for manual)

### Requirement: Account config analyzeMedia toggle
The `TwitterAccountConfig` SHALL include an `analyzeMedia: boolean` field (default `true`) that controls whether media is sent to the AI during repost generation for that account's tweets.

#### Scenario: Toggle in account settings
- **WHEN** a user views account configuration for a followed account
- **THEN** an "Analyze Media" toggle button is visible alongside existing toggles (hashtags, image generation, etc.)

#### Scenario: Toggle changes config
- **WHEN** a user toggles the analyzeMedia setting
- **THEN** the config is updated and subsequent repost generations for that account respect the new setting

### Requirement: Prompt awareness of attached images
When media is included in the Gemini call, the repost prompt SHALL inform the AI that an image is attached and instruct it to reference visual content when relevant.

#### Scenario: Prompt includes image note
- **WHEN** an image is included in the Gemini multimodal request
- **THEN** the text prompt includes a note telling the AI the original tweet has an attached image and to consider its content

#### Scenario: Prompt without image note
- **WHEN** no image is included in the request
- **THEN** the prompt does not mention any image

## Content Generation

### Requirement: Dedicated repost content generation prompt
The system SHALL have a dedicated generation prompt in its own file (`services/repost-prompt.ts`), separate from the existing content generation prompt. It SHALL instruct Gemini to create a quote-tweet response that adds genuine commentary, insight, or value to the original tweet. The prompt SHALL receive: the original tweet text, the account persona overview (if available), and the last 20-50 stored tweets from that account for conversation continuity.

#### Scenario: Generate with full context
- **WHEN** generation is triggered for a tweet from @vercel
- **THEN** the prompt SHALL include the original tweet, @vercel's persona overview, and recent tweet history

#### Scenario: Generate without persona
- **WHEN** generation is triggered and no persona overview exists for the account
- **THEN** the prompt SHALL still generate content using only the tweet text and any available tweet history

### Requirement: AI generation with context
The system SHALL generate a quote-tweet draft using the repost generation prompt, with context including: the tweet text (full thread if applicable), author profile info, persona overview (from account or persona cache), and the selected tone.

#### Scenario: Generation for followed account
- **WHEN** user clicks Generate for a tweet from a followed account
- **THEN** bot uses the stored persona overview and account config, generates content, creates a draft with source='repost', and shows the draft detail with image

#### Scenario: Generation for unknown account
- **WHEN** user clicks Generate for a tweet from an account not being followed
- **THEN** bot fetches/creates persona via X API profile + Gemini web search, caches it, generates content using DEFAULT config (with selected tone override), and shows draft detail

### Requirement: Tweet history context
The generation prompt SHALL include the last 20-50 tweets from the same account (from `twitter_tweets` table, ordered by `tweeted_at DESC`). This enables the AI to reference past events and maintain context continuity.

#### Scenario: Past reference capability
- **WHEN** the AI generates a quote tweet about a new release
- **THEN** it MAY reference a previous tweet from the same author about related work (e.g., "Following up on their compiler announcement last week...")

#### Scenario: Fewer than 20 stored tweets
- **WHEN** an account has only 5 stored tweets
- **THEN** all 5 SHALL be included as context

### Requirement: Repost draft creation
When a repost draft is generated, the system SHALL create a row in the `drafts` table with: `source='repost'`, `pr_number=0`, `pr_title='@username | first-100-chars'`, `commit_sha=original_tweet_id` (for idempotency), `original_tweet_id`, `original_tweet_url`, `content` as JSON DraftContent, and `status='draft'` (or `'approved'` for auto-approve accounts).

#### Scenario: Draft content structure
- **WHEN** a repost draft is created
- **THEN** `content` SHALL be a JSON DraftContent with `format='single'` (typical) or `format='thread'`, and `tweets` array with the generated text

#### Scenario: Auto-approve draft creation
- **WHEN** the account has `autoApprove=true` and the tweet scores above threshold
- **THEN** the draft SHALL be created with `status='approved'` instead of `'draft'`

### Requirement: Image generation for repost drafts
Repost draft image generation SHALL follow the same pattern as existing drafts: controlled by the account's `alwaysGenerateImage` and `singleImageProbability` config values. The generation prompt SHALL include an `imagePrompt` field in its response when image generation is applicable.

#### Scenario: Image generation disabled
- **WHEN** account config has `alwaysGenerateImage=false` and `singleImageProbability=0`
- **THEN** no image prompt SHALL be generated

#### Scenario: Probabilistic image generation
- **WHEN** account config has `singleImageProbability=0.3`
- **THEN** approximately 30% of generated drafts SHALL include an image prompt

### Requirement: Link twitter_tweet to draft after generation
After a draft is created from a scored tweet, the `twitter_tweets` row SHALL have its `status` updated to `'drafted'` and `draft_id` set to the created draft's ID.

#### Scenario: Tweet status after draft creation
- **WHEN** a draft is created for tweet "123"
- **THEN** `twitter_tweets` row "123" SHALL have `status='drafted'` and `draft_id` set

## Tone

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

### Requirement: Sarcastic tone option
The system SHALL add "sarcastic" to the available tone options in both the TwitterAccountConfig type and the manual repost tone selector. The sarcastic tone generates content that is sharp and incisive with Twitter-style humor — making strong points with wit and a respectful edge, never mean-spirited or personal.

#### Scenario: Sarcastic tone in account config
- **WHEN** user cycles through tone options in account settings
- **THEN** the tone cycle includes "sarcastic" as an option: professional → casual → analytical → enthusiastic → witty → sarcastic → professional

#### Scenario: Sarcastic tone in manual repost
- **WHEN** user selects "sarcastic" tone in the manual repost preview
- **THEN** the generated content uses the sarcastic tone prompt guidelines

### Requirement: Sarcastic tone prompt guidelines
The system SHALL include specific prompt instructions for the sarcastic tone that guide the AI to produce content that: makes sharp observations with humor, uses irony and wit effectively, maintains a respectful edge (never punches down), brings legitimate insights wrapped in cleverness, matches Twitter/X culture of smart commentary.

#### Scenario: Sarcastic tone generation
- **WHEN** content is generated with sarcastic tone
- **THEN** the output contains witty commentary that makes a genuine point, is engaging and shareable, and does not mock the original author personally

### Requirement: Tone label display
The system SHALL display the sarcastic tone with the label "😏 Sarcastic" in account settings and the tone selector UI.

#### Scenario: Tone display in account detail
- **WHEN** an account has tone set to "sarcastic"
- **THEN** the account detail view shows "😏 Sarcastic" as the tone label

#### Scenario: Tone display in repost preview
- **WHEN** "sarcastic" is selected in the manual repost tone selector
- **THEN** the button shows "😏 Sarcastic" with visual indication of selection

## Post-Generation

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
