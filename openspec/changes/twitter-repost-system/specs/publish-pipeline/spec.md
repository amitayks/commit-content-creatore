## ADDED Requirements

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

## MODIFIED Requirements

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
