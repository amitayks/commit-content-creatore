### Requirement: Shared publish pipeline function
The system SHALL provide a single `publishDraft(env, chatId, draft)` function in `core/publish.ts` that executes the full publish flow: parse content → get/generate image → upload media → post thread → update DB status → create published record.

#### Scenario: Publish draft with existing R2 image
- **WHEN** `publishDraft()` is called and the draft has `image_url` starting with `drafts/`
- **THEN** it reads the image from R2, uploads to X via `uploadMediaFromBuffer`, posts the thread, updates draft status to `published`, and creates a published record

#### Scenario: Publish draft without image, generates one
- **WHEN** `publishDraft()` is called and the draft has no `image_url` and no R2 image
- **THEN** it calls `generateImage()` to create one, uploads to X via `uploadMediaFromBuffer`, posts the thread, and updates status

#### Scenario: Publish draft when image generation fails
- **WHEN** `publishDraft()` is called and image generation/upload fails
- **THEN** it continues to post the thread without media, updates status, and creates the published record

#### Scenario: Publish draft returns result
- **WHEN** `publishDraft()` completes successfully
- **THEN** it returns `{ success: true, url: string, tweetIds: string[] }`

#### Scenario: Publish draft handles failure
- **WHEN** the thread posting fails
- **THEN** `publishDraft()` throws an error (callers handle their own error UI)

### Requirement: All publish flows use the shared pipeline
The publish action, publish-all-approved action, cron scheduled publish, and /approve command SHALL all use `publishDraft()` instead of duplicating the publish logic.

#### Scenario: Callback publish action uses pipeline
- **WHEN** user clicks the Publish button on a draft
- **THEN** the action handler calls `publishDraft()` and renders the result

#### Scenario: Cron publish uses pipeline
- **WHEN** the cron handler publishes scheduled drafts
- **THEN** it calls `publishDraft()` for each due draft

#### Scenario: Publish all approved uses pipeline
- **WHEN** user triggers publish-all-approved (via button or /approve command)
- **THEN** it loops through approved drafts calling `publishDraft()` for each

### Requirement: gemini.ts renamed from grok.ts contains only AI generation
The file `services/gemini.ts` (renamed from `grok.ts`) SHALL contain only AI-related functions: `generateContent`, `editContent`, `generateImage`, `callGeminiText`, `parseContentResponse`, prompts, and `consolidateImagePrompt`/`buildImagePrompt`. It SHALL NOT contain R2 storage operations.

#### Scenario: generateImage returns buffer data only
- **WHEN** `generateImage()` is called
- **THEN** it returns `{ data: ArrayBuffer; mimeType: string }` or `null` — it does NOT store anything in R2

### Requirement: Image storage consolidated in storage service
The system SHALL provide `services/storage.ts` that handles image persistence. Functions `generateAndStoreImage(env, chatId, draftId, content)` and `ensureImage(env, chatId, draft)` SHALL move from `grok.ts` to `storage.ts`. This service imports `generateImage` from `gemini.ts` and uses `env.IMAGES` (R2) for storage.

#### Scenario: generateAndStoreImage stores in R2
- **WHEN** `generateAndStoreImage()` is called
- **THEN** it calls `generateImage()` from `gemini.ts`, stores the result in R2, updates the draft's `image_url`, and returns the R2 key

#### Scenario: ensureImage checks R2 before generating
- **WHEN** `ensureImage()` is called for a draft that already has an `image_url`
- **THEN** it verifies the image exists in R2 and returns the URL without regenerating

### Requirement: Publish action returns draft detail for inline transition
After publishing a draft via the publish action handler, the system SHALL return `renderDraftDetail()` instead of `renderSuccess()`, so the user sees the published state with the tweet URL inline.

#### Scenario: Manual publish shows result inline
- **WHEN** user clicks "Publish Now" and the publish succeeds
- **THEN** the action SHALL return `renderDraftDetail()` for the published draft
- **AND** the published detail SHALL include the tweet URL

#### Scenario: Manual publish failure shows error inline
- **WHEN** user clicks "Publish Now" and the publish fails
- **THEN** the action SHALL return `renderError()` with a retry suggestion

### Requirement: Draft source field
The `drafts` table SHALL have a `source` column (`TEXT DEFAULT 'auto'`) to distinguish draft origin. Values: `'auto'` for webhook/generate-created drafts, `'handwrite'` for user-composed drafts, `'repost'` for Twitter quote-tweet drafts.

#### Scenario: Auto-generated draft has source auto
- **WHEN** a draft is created via webhook or `/generate` command
- **THEN** `source` SHALL default to `'auto'`

#### Scenario: Handwritten draft has source handwrite
- **WHEN** a draft is created via pen-down in compose mode
- **THEN** `source` SHALL be set to `'handwrite'`

#### Scenario: Repost draft has source repost
- **WHEN** a draft is created from a Twitter quote-tweet generation
- **THEN** `source` SHALL be set to `'repost'`

#### Scenario: Query drafts by source
- **WHEN** `getDraftsBySource(env, chatId, source)` is called
- **THEN** it SHALL return only drafts matching the given source value

### Requirement: Per-tweet media in publish flow
The `publishDraft()` function SHALL support per-tweet media attachments via the `Tweet.mediaKey` field, uploading each tweet's media individually to X.

#### Scenario: Publish thread with per-tweet media
- **WHEN** `publishDraft()` processes a thread where individual tweets have `mediaKey`
- **THEN** for each tweet with a `mediaKey`, it SHALL read the media from R2, upload to X via `uploadMediaFromBuffer`, and attach the media ID to that specific tweet
- **AND** tweets without `mediaKey` SHALL be posted without media

#### Scenario: Fallback to draft-level image for auto drafts
- **WHEN** `publishDraft()` processes a draft with no per-tweet media but with a draft-level `image_url`
- **THEN** the existing behavior SHALL apply: the draft-level image is attached to the first tweet only

### Requirement: AI refinement for handwritten content
The system SHALL provide a function to refine handwritten tweets via Gemini, preserving tweet count, order, and authorial voice.

#### Scenario: Refine handwritten tweets
- **WHEN** AI refinement is requested for handwritten tweets
- **THEN** the system SHALL send the tweets to Gemini with instructions to polish grammar, clarity, and engagement impact
- **AND** the response SHALL contain the same number of tweets in the same order
- **AND** the user's voice and intent SHALL be preserved

#### Scenario: Refine generates image prompt alongside
- **WHEN** both AI refinement and image generation are requested
- **THEN** Gemini SHALL return both refined tweets and a structured `ImagePromptData` in a single API call

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

### Requirement: Quote tweet publishing via quote_tweet_id
The `postTweet()` function SHALL accept an optional `quoteTweetId` in its options parameter. When provided, the X API v2 request body SHALL include `quote_tweet_id` as a top-level field.

#### Scenario: Post quote tweet
- **WHEN** `postTweet(env, "Great release!", { quoteTweetId: "123456" })` is called
- **THEN** the request body SHALL be `{ text: "Great release!", quote_tweet_id: "123456" }`

#### Scenario: Post without quote (backwards compatible)
- **WHEN** `postTweet(env, "Hello world")` is called without quoteTweetId
- **THEN** the request body SHALL NOT include `quote_tweet_id`

### Requirement: Repost draft publish flow
The `publishDraft()` function SHALL detect repost drafts by `source='repost'` and publish them as quote tweets. For single-tweet repost drafts, it SHALL call `postTweet()` with the tweet text and `quoteTweetId` from `draft.original_tweet_id`. For thread repost drafts, the first tweet SHALL be the quote tweet and subsequent tweets SHALL be replies to it.

#### Scenario: Publish single repost draft
- **WHEN** `publishDraft()` processes a draft with `source='repost'` and `format='single'`
- **THEN** it SHALL call `postTweet(env, text, { quoteTweetId: draft.original_tweet_id, mediaIds })` instead of `postThread()`

#### Scenario: Publish thread repost draft
- **WHEN** `publishDraft()` processes a draft with `source='repost'` and `format='thread'`
- **THEN** the first tweet SHALL be posted with `quoteTweetId`, and subsequent tweets SHALL be posted as replies to the first tweet

#### Scenario: Repost publish result
- **WHEN** a repost draft is published successfully
- **THEN** it SHALL return `{ success: true, url: string, tweetIds: string[] }` matching the existing interface

### Requirement: Image handling for repost drafts
Repost draft publishing SHALL follow the same image handling as existing drafts: check for R2 image, upload to X if present, generate if needed and configured. The account's image config (from the linked twitter_account) SHALL control whether images are generated.

#### Scenario: Repost with image
- **WHEN** a repost draft has an `image_url` in R2
- **THEN** the image SHALL be uploaded to X and attached to the quote tweet

#### Scenario: Repost without image
- **WHEN** a repost draft has no image and account config has `alwaysGenerateImage=false`
- **THEN** the quote tweet SHALL be posted without media
