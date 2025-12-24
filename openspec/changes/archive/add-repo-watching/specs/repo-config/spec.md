# Repo Configuration Capability

## Overview
Each watched repository can have custom configuration for content generation, including tone, hashtags, and trigger settings.

## ADDED Requirements

### Requirement: Default Configuration
New repos start with sensible defaults.

#### Scenario: New repo gets default config
- **Given**: User adds a new repo
- **When**: Repo is saved to database
- **Then**: Config is set to:
  - `tone: "professional"`
  - `includeHashtags: true`
  - `watchPRs: true`
  - `watchPushes: false`
  - `branches: ["main"]`
  - `platform: "x"`

---

### Requirement: View Configuration
Users can view the current config for a repo.

#### Scenario: View config in repo detail
- **Given**: User is viewing repo detail
- **Then**: Current config settings are displayed:
  - Tone setting
  - Hashtag preference
  - What events are watched
  - Which branches are watched

---

### Requirement: Edit Configuration (Future Phase)
Users can modify repo configuration via the bot.

#### Scenario: Edit tone
- **Given**: User clicks "✏️ Edit" on repo detail
- **When**: Bot shows config editor
- **And**: User selects different tone
- **Then**: Config is updated in database
- **And**: Future content uses new tone

#### Scenario: Toggle hashtags
- **Given**: User is editing config
- **When**: User toggles "Include hashtags"
- **Then**: Config is updated
- **And**: Future content includes/excludes hashtags accordingly

#### Scenario: Change watched branches
- **Given**: User is editing config
- **When**: User modifies branch list
- **Then**: Config is updated
- **And**: Only specified branches trigger auto-detection

---

### Requirement: Apply Configuration During Generation
Content generation respects repo-specific settings.

#### Scenario: Tone affects prompt
- **Given**: Repo has `tone: "casual"`
- **When**: Content is generated
- **Then**: Grok prompt includes instruction for casual tone

#### Scenario: Hashtags setting applied
- **Given**: Repo has `includeHashtags: false`
- **When**: Content is generated
- **Then**: Grok prompt instructs to avoid hashtags

---

## Configuration Schema

```typescript
interface RepoConfig {
  // Content generation style
  tone: 'professional' | 'casual' | 'technical';
  includeHashtags: boolean;
  
  // Trigger settings  
  watchPRs: boolean;
  watchPushes: boolean;
  branches: string[];
  
  // Publishing platform
  platform: 'x';  // Future: 'linkedin' | 'threads'
  
  // Optional customization
  customPromptAddition?: string;
}
```

## Database Schema

```sql
CREATE TABLE repos (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  is_watching INTEGER DEFAULT 1,
  config TEXT NOT NULL,  -- JSON of RepoConfig
  webhook_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(owner, repo)
);
```
