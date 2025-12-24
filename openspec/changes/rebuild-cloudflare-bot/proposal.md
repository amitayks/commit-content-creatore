# Rebuild Cloudflare Telegram Bot

## Summary
Complete rebuild of the Telegram bot on Cloudflare Workers with D1 database. This replaces the GitHub Actions-based workflow with a 100% edge-based architecture for instant responses and real-time publishing.

## Motivation
- **Current pain**: Bot responses feel slow, split architecture is complex
- **User need**: Instant feedback, real-time publishing, clean UX
- **Technical opportunity**: Cloudflare Workers free tier is sufficient for this use case

## User Requirements

### Bot Command Structure

```
/start → Status Dashboard
┌─────────────┬────────────┬─────────────┐
│   Approve   │  Generate  │   Drafts    │
├─────────────┼────────────┼─────────────┤
│    Help     │  Schedule  │   Delete    │
└─────────────┴────────────┴─────────────┘
```

| Command | Action |
|---------|--------|
| **Approve** | Publish all approved drafts immediately (excludes scheduled) |
| **Generate** | Prompt for commit SHA → generates draft for the PR |
| **Drafts** | Paginated list of drafts with approve/edit/reject/regenerate/schedule |
| **Help** | Usage instructions |
| **Schedule** | Schedule a post for specific commit/PR |
| **Delete** | Find and delete posts by commit SHA |

### UX Principles
1. **Single message updates** - Never spam multiple messages - send new message only if the user has sended new message, for conversational flow.
2. **Commit → PR mapping** - Any commit SHA resolves to its parent PR
3. **All slash commands work** - `/generate`, `/approve`, `/drafts`, etc.

## Technical Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Cloudflare Workers                    │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Telegram    │  │   GitHub     │  │    Grok      │  │
│  │  Webhook     │  │    API       │  │    API       │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                          │                              │
│                    ┌─────▼─────┐                        │
│                    │    D1     │                        │
│                    │ Database  │                        │
│                    └───────────┘                        │
│                          │                              │
│  ┌──────────────┐  ┌─────▼──────┐  ┌──────────────────┐│
│  │  X/Twitter   │  │   Image    │  │  Scheduled Jobs  ││
│  │    API       │  │ Generation │  │  (Cron Trigger)  ││
│  └──────────────┘  └────────────┘  └──────────────────┘│
└─────────────────────────────────────────────────────────┘
```

## Database Schema (D1)

```sql
-- Drafts table
CREATE TABLE drafts (
  id TEXT PRIMARY KEY,
  pr_number INTEGER NOT NULL,
  pr_title TEXT,
  commit_sha TEXT NOT NULL,
  status TEXT DEFAULT 'draft', -- draft|approved|published|rejected|scheduled
  content TEXT NOT NULL,       -- JSON: { tweets: [...], format: 'thread' }
  image_url TEXT,              -- Generated image URL (if any)
  scheduled_at TEXT,           -- ISO timestamp for scheduled posts
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Chat state for Telegram UI
CREATE TABLE chat_state (
  chat_id TEXT PRIMARY KEY,
  message_id INTEGER,          -- Current dashboard message
  current_view TEXT,           -- home|drafts|draft_detail|generate|schedule|delete
  context TEXT,                -- JSON for pagination, selected draft, etc.
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Published posts archive
CREATE TABLE published (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL,
  pr_number INTEGER,
  tweet_ids TEXT NOT NULL,     -- JSON array
  tweet_url TEXT,
  image_url TEXT,
  published_at TEXT DEFAULT (datetime('now'))
);
```

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/telegram-webhook` | POST | Telegram bot updates |
| `/health` | GET | Health check |
| `/migrate` | GET | Run D1 migrations |

## Cron Jobs

| Schedule | Purpose |
|----------|---------|
| `0 * * * *` (hourly) | Publish scheduled posts that are due |
| `0 0 * * *` (daily) | Cleanup old rejected drafts |

## Out of Scope
- Automatic PR monitoring (user triggers generation manually)
- Multi-user support (single admin chat)
- Message editing in Telegram (use regenerate instead)

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Grok API slow/down | Show "generating..." feedback, timeout after 30s |
| X API rate limits | Queue with exponential backoff |
| Telegram edit fails | Send new message, update chat_state |

## Success Criteria
- [ ] Bot responds to all commands within 1 second
- [ ] Generate draft from commit SHA works end-to-end
- [ ] Publishing to X with image works
- [ ] Scheduled posts publish automatically
- [ ] Delete by commit SHA works
