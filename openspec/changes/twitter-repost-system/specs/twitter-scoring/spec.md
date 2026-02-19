## ADDED Requirements

### Requirement: Batch scoring via single Gemini call
The system SHALL score all pending tweets from a poll cycle in a single Gemini API call. The scoring function SHALL accept an array of tweets (with author, text, conversation context) and return an array of `{ tweet_id: string, score: number, reason: string }`.

#### Scenario: Batch with multiple tweets
- **WHEN** 15 new tweets are pending across 10 accounts
- **THEN** all 15 SHALL be sent in one Gemini call and scored individually

#### Scenario: No pending tweets
- **WHEN** no tweets have `status='pending'` after polling
- **THEN** the scoring step SHALL be skipped entirely

### Requirement: Dedicated scoring system prompt
The scoring prompt SHALL be in its own file (`services/scoring-prompt.ts`). It SHALL instruct Gemini to evaluate each tweet for: type of content (release, bug fix, announcement, technical insight, tutorial, opinion, personal, meme), relevance to a tech-focused developer audience, engagement potential, and timeliness. The prompt SHALL return a JSON array of scores 1-10 with brief reasons.

#### Scenario: Release announcement scores high
- **WHEN** a tweet says "We just released v2.0 with major performance improvements"
- **THEN** the score SHALL be 8-10 with reason indicating it's a release announcement

#### Scenario: Personal tweet scores low
- **WHEN** a tweet says "Great coffee this morning"
- **THEN** the score SHALL be 1-2 with reason indicating it's personal/off-topic

#### Scenario: Thread scored as unit
- **WHEN** a complete thread (3 tweets) is submitted for scoring
- **THEN** it SHALL be scored as a single unit based on the full thread content, returning one score for the conversation_id

### Requirement: Per-account threshold filtering
After scoring, tweets SHALL be filtered against each account's `relevanceThreshold` config value. Tweets scoring below the threshold SHALL have their `status` updated to `'skipped'`. Tweets at or above SHALL be updated to `'scored'`.

#### Scenario: Tweet below threshold
- **WHEN** a tweet scores 4 and the account threshold is 6
- **THEN** the tweet `status` SHALL be set to `'skipped'`

#### Scenario: Tweet meets threshold
- **WHEN** a tweet scores 7 and the account threshold is 6
- **THEN** the tweet `status` SHALL be set to `'scored'` with `relevance_score=7` and `relevance_reason` stored

### Requirement: Score and reason stored on tweet record
After scoring, each tweet's `relevance_score` (INTEGER) and `relevance_reason` (TEXT) columns in `twitter_tweets` SHALL be updated with the AI's response.

#### Scenario: Score persistence
- **WHEN** the AI returns `{ tweet_id: "123", score: 8, reason: "Major framework release" }`
- **THEN** the twitter_tweets row with id "123" SHALL have `relevance_score=8` and `relevance_reason="Major framework release"`
