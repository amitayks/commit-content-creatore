# Content Generation Capability

## ADDED Requirements

### Requirement: PR Resolution from Commit
The system MUST resolve any commit SHA to its parent Pull Request.

#### Scenario: Commit belongs to merged PR
**Given** commit `abc123` is part of merged PR #42
**When** the system calls `getPRForCommit('abc123')`
**Then** it returns:
  - PR number: 42
  - PR title: "Add user authentication"
  - PR body/description
  - All commit SHAs in the PR
  - Merge commit SHA
  - Files changed with diff stats

#### Scenario: Commit not in any PR
**Given** commit `xyz789` was pushed directly to main
**When** the system calls `getPRForCommit('xyz789')`
**Then** it throws `CommitNotInPRError`
**And** the error message explains the commit is not part of a merged PR

#### Scenario: Commit SHA not found
**Given** commit `invalid` does not exist
**When** the system calls `getPRForCommit('invalid')`
**Then** it throws `CommitNotFoundError`
**And** the error includes the SHA for debugging

---

### Requirement: AI Content Generation
The system MUST generate post content from PR data using Grok API, choosing single tweet or thread based on content.

#### Scenario: Generate single tweet for small PR
**Given** PR #42 with:
  - Title: "Fix typo in README"
  - Files: 1 changed, +1 -1 lines
**When** `generateContent(prData)` is called
**Then** Grok API returns a single tweet:
  - 1 tweet ≤ 280 characters
  - Concise and complete
  - With relevant emoji
  - Image will be attached

#### Scenario: Generate thread for complex PR
**Given** PR #42 with:
  - Title: "Add OAuth2 authentication"
  - Files: 5 changed, +200 -50 lines
  - Description: "Implements Google OAuth..."
**When** `generateContent(prData)` is called
**Then** Grok API returns a tweet thread with:
  - 2-5 tweets (as needed)
  - Each tweet ≤ 280 characters
  - First tweet: hook/summary (image attached here)
  - Following tweets: details
  - Professional but engaging tone

#### Scenario: AI decides format based on complexity
**Given** any PR
**When** content is generated
**Then** the AI chooses:
  - **Single tweet**: Simple changes (docs, typos, small fixes)
  - **Thread**: Feature additions, refactors, complex changes
**And** the content JSON includes `format: 'single' | 'thread'`

#### Scenario: Large PR generates focused thread
**Given** a PR with 50 files changed
**When** content is generated
**Then** the thread focuses on the key changes
**And** does not exceed 5 tweets
**And** mentions "and more" if details are omitted

#### Scenario: Generation timeout
**Given** the Grok API takes more than 25 seconds
**When** the timeout is reached
**Then** the system throws `GenerationTimeoutError`
**And** suggests retrying

---

### Requirement: AI Image Generation
The system MUST generate a relevant image for each post using Grok API.

#### Scenario: Generate image for PR
**Given** a tweet thread about OAuth implementation
**When** `generateImage(threadContent)` is called
**Then** Grok API returns:
  - A visually appealing image
  - Related to the content theme (security, code, tech)
  - Suitable for Twitter card display (16:9 or 1:1)
  - Image data as base64 or URL

#### Scenario: Image generation fails
**Given** the image API is unavailable
**When** generation fails
**Then** the system logs the error
**And** continues with text-only post
**And** the draft is marked `image_generation_failed: true`

---

### Requirement: Draft Storage
The system MUST persist generated drafts in D1 database.

#### Scenario: Save new draft
**Given** content is generated for PR #42
**When** the draft is saved
**Then** the database stores:
  - Unique draft ID (UUID)
  - PR number
  - PR title
  - Commit SHA (the one used to trigger)
  - Status: 'draft'
  - Content: JSON with tweet array
  - created_at timestamp
  - updated_at timestamp

#### Scenario: Update draft status
**Given** draft `draft-123` exists with status 'draft'
**When** user approves it
**Then** status changes to 'approved'
**And** updated_at is refreshed

#### Scenario: Query drafts by status
**Given** 5 drafts exist: 2 draft, 2 approved, 1 rejected
**When** `getDraftsByStatus('approved')` is called
**Then** exactly 2 drafts are returned
**And** ordered by created_at descending

---

### Requirement: Regeneration
The system MUST allow regenerating content for a draft.

#### Scenario: Regenerate draft content
**Given** draft `draft-123` for PR #42 exists
**When** user clicks "Regenerate"
**Then** the system:
  1. Fetches fresh PR data from GitHub
  2. Calls Grok API with slightly different prompt (for variety)
  3. Updates the draft content in database
  4. Shows new preview to user

#### Scenario: Regeneration preserves metadata
**Given** a draft with scheduled_at set
**When** regenerated
**Then** the new content is saved
**But** scheduled_at and other metadata are preserved
**And** updated_at is refreshed
