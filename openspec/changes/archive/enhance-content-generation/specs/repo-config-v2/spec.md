# Spec: Repo Config V2

## MODIFIED Requirements

### REQ-CONFIG-001: Extended RepoConfig Interface
RepoConfig shall include new generation control options.

#### Scenario: Default config for new repo
- Given a new repo is added
- When default config is applied
- Then config includes:
  - codeContext: 'metadata'
  - language: 'en'
  - minCommitsForThread: 3
  - maxTweets: 10
  - alwaysGenerateThreadImage: true
  - singleTweetImageProbability: 0.7

## ADDED Requirements

### REQ-CONFIG-002: Code Context Level
System shall fetch different levels of code context based on config.

#### Scenario: metadata level
- Given codeContext is 'metadata'
- When fetching ContentSource
- Then only PR/commit title, author, stats are included

#### Scenario: with_diff level
- Given codeContext is 'with_diff'
- When fetching ContentSource
- Then metadata + full patch/diff is included (up to 4000 chars)
- And additions are marked with `+`, deletions with `-`

#### Scenario: with_files level
- Given codeContext is 'with_files'
- When fetching ContentSource
- Then metadata + diff + full list of changed file paths

#### Scenario: with_content level (⚠️ USE WITH CAUTION)
- Given codeContext is 'with_content'
- When fetching ContentSource
- Then metadata + diff + actual content of changed files
- And WARNING: Only use for small repos/changes
- And WARNING: May hit token limits on large changes
- And files are truncated at 8000 chars each

### REQ-CONFIG-003: Language Selection
Content generation shall use language-specific prompts.

#### Scenario: English content
- Given language is 'en'
- When generating content
- Then English system prompt is used

#### Scenario: Hebrew content
- Given language is 'he'
- When generating content
- Then Hebrew system prompt is used

### REQ-CONFIG-004: Thread Control
Thread/single decision shall respect config thresholds.

#### Scenario: Small change as single tweet
- Given commit with 2 file changes
- And minCommitsForThread is 3
- When generating content
- Then format is 'single'

#### Scenario: Large change as thread
- Given commit with 5 file changes
- And maxTweets is 10
- When generating content
- Then thread has at most 10 tweets

### REQ-CONFIG-005: Config UI Toggles
All new config options shall be editable via Telegram UI.

#### Scenario: Toggle code context
- Given user is on repo config screen
- When user taps codeContext button
- Then cycles through: metadata → with_diff → with_files
