# Design: Commit Content Tracker Architecture

## Context

This system transforms GitHub activity (PRs, commits) into engaging X threads through AI, with a Telegram bot interface for review and approval. It runs serverlessly via GitHub Actions.

### Stakeholders
- **Primary user**: Developer who wants to automate content creation about their work
- **Audience**: X (Twitter) followers interested in technical content

### Constraints
- Must run on GitHub Actions free tier (2,000 minutes/month)
- Must support multiple configured projects
- Must not auto-publish without explicit approval
- Must handle X API rate limits gracefully

## Goals / Non-Goals

### Goals
- Fully automated pipeline from commit → draft → notification → approval → publish
- Natural, human-like content that doesn't feel bot-generated
- Quick review workflow via Telegram (under 30 seconds to approve)
- Per-project customization of content style and tone
- Reliable message delivery and error handling

### Non-Goals
- Real-time processing (acceptable latency: 1-5 minutes)
- Complex analytics or metrics
- Multi-user collaboration
- Web-based dashboard (v1 is Telegram-only)

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              GitHub Actions                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   Webhook   │───▶│   Content   │───▶│    Draft    │───▶│  Telegram   │  │
│  │   Handler   │    │  Generator  │    │   Storage   │    │    Bot      │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│         │                  │                  │                  │          │
│         ▼                  ▼                  ▼                  ▼          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   GitHub    │    │  Grok API   │    │   JSON/DB   │    │  Telegram   │  │
│  │     API     │    │   (xAI)     │    │   (State)   │    │     API     │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│                                                                              │
│                              ┌─────────────┐                                │
│                              │ X Publisher │◀──── Approved Drafts           │
│                              └─────────────┘                                │
│                                     │                                        │
│                                     ▼                                        │
│                              ┌─────────────┐                                │
│                              │  X API v2   │                                │
│                              └─────────────┘                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Decisions

### Decision 1: GitHub Actions as Runtime
**What**: Use GitHub Actions for all processing instead of a dedicated server.
**Why**: 
- Free tier sufficient for personal use
- No infrastructure to maintain
- Native GitHub integration (webhooks, secrets management)
- Automatic scaling
**Alternatives considered**:
- Self-hosted server (Raspberry Pi): Requires maintenance, power, networking
- Cloud functions (Vercel/Railway): Additional cost and complexity

### Decision 2: JSON File Storage for State
**What**: Store drafts and state as JSON files in the repository instead of a database.
**Why**:
- Zero infrastructure cost
- Version controlled (Git history of all drafts)
- Simple to debug and manually edit
- Works within GitHub Actions constraints
**Trade-offs**:
- Limited concurrent write handling (addressed via Action job serialization)
- File size limits (acceptable for text content)
**Alternatives considered**:
- SQLite: Requires persistent storage
- External DB (Supabase): Added dependency, cost, complexity

### Decision 3: Telegram as Primary Interface
**What**: Use Telegram Bot as the sole review interface (no web dashboard).
**Why**:
- Mobile-first review (approve from anywhere)
- Rich inline buttons for quick actions
- Push notifications built-in
- Minimal development effort
- Interactive capabilities (reply to edit)
**Alternatives considered**:
- Web dashboard: Much higher development effort
- Email notifications: No interactive capabilities
- GitHub Issues: Clunky for quick approval

### Decision 4: Single AI Call per Event
**What**: Generate complete content in a single Grok API call rather than iterative refinement.
**Why**:
- Minimize API costs
- Reduce latency
- Simpler error handling
- AI already produces high-quality output with good prompts
**Alternatives considered**:
- Multi-step generation: Higher cost, more failure points
- Streaming: Not needed for async workflow

### Decision 5: Thread Format Detection
**What**: AI autonomously decides between single tweet and thread based on content scope.
**Why**:
- More natural content
- Avoids forced threading of small changes
- Avoids cramming major features into single tweet
**Implementation**: Include decision criteria in AI prompt; output includes format choice.

## Project Structure

```
commit-content-tracker/
├── .github/
│   └── workflows/
│       ├── webhook-handler.yml      # Receives GitHub webhooks
│       ├── content-generator.yml    # Generates drafts from events
│       ├── telegram-bot.yml         # Handles Telegram callbacks
│       └── publisher.yml            # Publishes approved content
├── src/
│   ├── index.ts                     # Main entry point
│   ├── constants.ts                 # Configuration constants
│   ├── types/
│   │   ├── github.ts               # GitHub event types
│   │   ├── content.ts              # Draft and thread types
│   │   └── config.ts               # Project config types
│   ├── services/
│   │   ├── github.service.ts       # GitHub API integration
│   │   ├── grok.service.ts         # Grok AI integration
│   │   ├── telegram.service.ts     # Telegram Bot API
│   │   ├── x.service.ts            # X publishing
│   │   └── storage.service.ts      # JSON file management
│   ├── generators/
│   │   ├── prompt-builder.ts       # Build AI prompts
│   │   └── content-parser.ts       # Parse AI responses
│   └── utils/
│       ├── logger.ts               # Logging utility
│       └── retry.ts                # Retry logic
├── config/
│   ├── projects/                   # Per-project configs
│   │   ├── project-a.yaml
│   │   └── project-b.yaml
│   └── prompts/
│       ├── thread-generation.md    # Main prompt template
│       └── image-generation.md     # Image prompt template
├── data/
│   ├── drafts/                     # Draft storage
│   │   └── {draft-id}.json
│   └── published/                  # Archive of published content
│       └── {date}-{draft-id}.json
├── package.json
├── tsconfig.json
└── README.md
```

## Data Models

### Draft Object
```typescript
interface Draft {
  id: string;                    // UUID
  projectId: string;             // Which project this belongs to
  status: 'draft' | 'approved' | 'rejected' | 'published';
  createdAt: string;             // ISO timestamp
  updatedAt: string;
  
  // Source information
  source: {
    type: 'pr' | 'push' | 'manual';
    url: string;                 // GitHub URL
    ref: string;                 // Branch/PR number
    commits: string[];           // Commit SHAs
  };
  
  // Generated content
  content: {
    format: 'single' | 'thread';
    tweets: Tweet[];             // Array of tweet objects
    image?: string;              // Optional image URL/path
  };
  
  // Metadata
  telegramMessageId?: number;    // For updating the preview
  publishedTweetId?: string;     // After publishing
  regenerationCount: number;     // How many times regenerated
}

interface Tweet {
  text: string;                  // Tweet content (max 280 chars)
  mediaPath?: string;            // Optional media attachment
}
```

### Project Configuration
```yaml
# config/projects/my-project.yaml
project:
  id: "my-project"
  name: "My Awesome Project"
  repository: "username/repo-name"

triggers:
  branches:
    - main
    - release/*
  events:
    - pr_merged
    - push
  file_patterns:
    include:
      - "src/**"
      - "*.ts"
    exclude:
      - "*.test.ts"
      - "node_modules/**"

content:
  types:
    - technical      # Deep dives into code patterns
    - feature        # What the change accomplishes
    - learning       # Tech discoveries and tools
  tone: "professional-casual"  # Options: formal, casual, technical, enthusiastic
  
formatting:
  hashtags:
    always: ["#DevLife", "#OpenSource"]
    project: ["#MyProject"]
  mentions: []
  emojis: true
  
thread:
  min_commits_for_thread: 3
  max_tweets: 10
```

## Risks / Trade-offs

### Risk: GitHub Actions Timeout
**Concern**: Complex AI generation might exceed 6-hour job timeout.
**Mitigation**: 
- Single API call per event
- Timeout handling with graceful failure
- Retry on next scheduled run

### Risk: Grok API Availability
**Concern**: Grok API is newer, might have availability issues.
**Mitigation**:
- Implement fallback to Claude/OpenAI
- Retry logic with exponential backoff
- Alert on repeated failures

### Risk: X API Rate Limits
**Concern**: Free tier has strict limits (1,500 tweets/month).
**Mitigation**:
- Queue-based publishing with rate awareness
- Batch publishing at optimal times
- Track usage in state file

### Risk: State File Conflicts
**Concern**: Concurrent workflow runs might corrupt JSON state.
**Mitigation**:
- Use GitHub Actions concurrency groups
- Atomic file operations with temp files
- Validate JSON before/after writes

## Migration Plan

Not applicable—this is a greenfield project.

## Open Questions

1. **Image generation frequency**: Should every thread have an AI-generated image, or only major features?
   - **Proposed**: Images for threads 3+ tweets, optional for single tweets
   i like the idea, lets say that it be more common to have an image then not, in single tweets, but in thred always have im age to each prompt, for great awarness.

2. **Commit batching**: How long to wait before generating content for rapid commits?
   - **Proposed**: 5-minute debounce after push events, immediate for PR merges
  lets the wait be half an houre at least, but indeed immediately for pr (im moslty sheet full features in big push and commits only for bug fixex or feature inmprovment.)
3. **Content history**: How long to retain published content in archive?
   - **Proposed**: 90 days, configurable
