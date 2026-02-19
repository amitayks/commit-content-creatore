## ADDED Requirements

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
