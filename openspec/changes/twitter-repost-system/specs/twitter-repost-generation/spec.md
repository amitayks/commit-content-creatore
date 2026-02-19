## ADDED Requirements

### Requirement: Dedicated repost content generation prompt
The system SHALL have a dedicated generation prompt in its own file (`services/repost-prompt.ts`), separate from the existing content generation prompt. It SHALL instruct Gemini to create a quote-tweet response that adds genuine commentary, insight, or value to the original tweet. The prompt SHALL receive: the original tweet text, the account persona overview (if available), and the last 20-50 stored tweets from that account for conversation continuity.

#### Scenario: Generate with full context
- **WHEN** generation is triggered for a tweet from @vercel
- **THEN** the prompt SHALL include the original tweet, @vercel's persona overview, and recent tweet history

#### Scenario: Generate without persona
- **WHEN** generation is triggered and no persona overview exists for the account
- **THEN** the prompt SHALL still generate content using only the tweet text and any available tweet history

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

### Requirement: Persona bootstrap with Gemini web search
The system SHALL provide a function to bootstrap an account persona overview by: fetching the X profile data (bio, name, followers), fetching recent tweets (up to 50), and calling Gemini with web search grounding enabled to research the person/company and generate a structured persona. The result SHALL be stored in `twitter_account_overviews`.

#### Scenario: Bootstrap corporate account
- **WHEN** bootstrap is triggered for @anthropic
- **THEN** Gemini SHALL search the web for "Anthropic", combine with X profile data and recent tweets, and generate persona fields: persona summary, topics array, communication style, notable context, recent themes

#### Scenario: Bootstrap individual developer
- **WHEN** bootstrap is triggered for @somedev
- **THEN** Gemini SHALL use X profile + recent tweets (web search may not find much), and generate persona based primarily on their tweet history

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
