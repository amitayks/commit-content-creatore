# Design: Enhanced Content Generation

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Content Generation Flow                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Webhook/Manual → Fetch Context → Generate Content → Store Draft │
│                        │                  │                       │
│                        ▼                  ▼                       │
│                   GitHub API        Grok Text API                 │
│                (code context)      ┌─────────────┐               │
│                        │           │ Tweet JSON  │               │
│                        │           │ Image Prompt │               │
│                        │           └──────┬──────┘               │
│                        │                  │                       │
│                        │                  ▼                       │
│                        │           Grok Image API                 │
│                        │                  │                       │
│                        │                  ▼                       │
│                        │           R2 Storage                     │
│                        │                  │                       │
│                        ▼                  ▼                       │
│                   D1 Database ◄────────────────                   │
│                   (draft + image_url)                             │
│                        │                                          │
│                        ▼                                          │
│                   Telegram Preview                                │
└─────────────────────────────────────────────────────────────────┘
```

## Data Structures

### Extended RepoConfig
```typescript
interface RepoConfig {
  // Existing
  tone: 'professional' | 'casual' | 'technical';
  includeHashtags: boolean;
  watchPRs: boolean;
  watchPushes: boolean;
  branches: string[];
  platform: 'x';
  
  // NEW
  codeContext: 'metadata' | 'with_diff' | 'with_files';
  language: 'en' | 'he';
  minCommitsForThread: number;
  maxTweets: number;
  alwaysGenerateThreadImage: boolean;
  singleTweetImageProbability: number;
}
```

### Grok Response Format (Updated)
```typescript
interface GrokContentResponse {
  format: 'single' | 'thread';
  tweets: { text: string; index: number }[];
  imagePrompt: string; // NEW: Grok generates this
}
```

## Key Decisions

### 1. Code Context Levels
| Level | What's Sent | Use Case |
|-------|-------------|----------|
| `metadata` | Title, author, stats only | Fast, generic content |
| `with_diff` | + Top 5 key changed lines | Technical details |
| `with_files` | + Full file names list | Comprehensive |

### 2. Image Prompt Generation
Grok generates the image prompt alongside tweet content - not separate call. This ensures visual coherence with text content.

### 3. R2 Storage Pattern
- Key: `drafts/{draft_id}/image.png`
- Public URL stored in D1 `image_url` field
- Deleted when draft is deleted

## Edit Flow

```
User clicks Edit → Bot asks for instructions
        ↓
User sends message → Stored in context
        ↓
Load original draft + ContentSource
        ↓
Send to Grok: "Original content + User instruction → Refine"
        ↓
Update same draft ID with new content
        ↓
Regenerate image if configured
        ↓
Show updated draft
```
