# OpenSpec Proposal: Interactive Dashboard Bot

## Status
🔵 **PROPOSED** | Priority: High | Estimated: 2 days

## Overview

Transform the Telegram bot from GitHub Actions-based to a **Cloudflare Worker-first** architecture with an **interactive dashboard message** that updates dynamically.

---

## Migration: GitHub Actions → Cloudflare Worker

### Before (Current)
```
Telegram → Cloudflare Worker → GitHub Actions → Response
                                 (30-60s delay)
```

### After (Proposed)
```
Telegram → Cloudflare Worker + D1 Database → Response
                 (~100ms instant)
                      │
                      ├── Simple commands: Handled directly
                      └── Heavy operations: Trigger GitHub Actions async
```

### What Moves to Cloudflare

| Feature | Before | After |
|---------|--------|-------|
| `/menu`, `/help` | GitHub Actions | **Cloudflare Worker** |
| View drafts | GitHub Actions | **Cloudflare Worker** |
| View stats | GitHub Actions | **Cloudflare Worker** |
| Approve/Reject | GitHub Actions | **Cloudflare Worker** |
| `/generate` | GitHub Actions | GitHub Actions (async) |
| `/publish` | GitHub Actions | **Cloudflare Worker** (X API) |

### Storage Migration

| Data | Before | After |
|------|--------|-------|
| Drafts | JSON files in repo | **Cloudflare D1** |
| State | N/A | **Cloudflare D1** |
| Published archive | JSON files | Cloudflare D1 |

---

## Interactive Dashboard UX

### Welcome Message (Entry Point)

When user sends any message or `/start`:

```
┌─────────────────────────────────────────────────┐
│  � Welcome to Content Tracker!                │
│                                                 │
│  I turn your GitHub commits into engaging      │
│  X (Twitter) threads automatically.            │
│                                                 │
│  📝 Pending: 3 drafts ready for review         │
│  ✅ Published: 12 threads this month           │
│                                                 │
│  [� View Drafts] [� Stats] [⚙️ Settings]    │
│  [🔄 Generate] [❓ Help]                       │
└─────────────────────────────────────────────────┘
```

### Navigation Flow

```
[Welcome/Home]
      │
      ├── [📋 View Drafts] ──▶ Draft List ──▶ Draft Preview ──▶ [Approve/Reject]
      │                              │
      │                              └── [◀️ Back]
      │
      ├── [📊 Stats] ──▶ Statistics View ──▶ [◀️ Back]
      │
      ├── [⚙️ Settings] ──▶ Settings (future)
      │
      ├── [🔄 Generate] ──▶ "Enter commit SHA:" ──▶ Triggers generation
      │
      └── [❓ Help] ──▶ Help View ──▶ [◀️ Back]
```

### All Interactions Update Same Message
- No spam of multiple messages
- Instant ~100ms response
- Clean, app-like experience

---

## Database Schema (Cloudflare D1)

```sql
-- Drafts table
CREATE TABLE drafts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  status TEXT DEFAULT 'draft', -- draft, approved, rejected, published
  content TEXT, -- JSON: {format, tweets}
  source TEXT,  -- JSON: {type, url, ref}
  telegram_message_id INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
);

-- Chat state (for multi-step flows)
CREATE TABLE chat_state (
  chat_id TEXT PRIMARY KEY,
  dashboard_message_id INTEGER,
  current_view TEXT DEFAULT 'home',
  awaiting_input TEXT, -- null, 'commit_sha', 'edit_text'
  context TEXT -- JSON for any additional state
);

-- Published archive
CREATE TABLE published (
  id TEXT PRIMARY KEY,
  draft_id TEXT,
  tweet_ids TEXT, -- JSON array
  published_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

---

## Implementation Tasks

### Phase 1: Core Migration
- [ ] Set up Cloudflare D1 database
- [ ] Create database schema
- [ ] Implement view renderers (home, drafts, stats, help)
- [ ] Implement button callback routing
- [ ] Handle message editing (single message dashboard)

### Phase 2: Draft Management
- [ ] List drafts from D1
- [ ] View single draft
- [ ] Approve/Reject (update D1)
- [ ] Regenerate (trigger GitHub Action)

### Phase 3: Publishing
- [ ] Move X API integration to Cloudflare Worker
- [ ] Publish directly from worker
- [ ] Archive published content in D1

### Phase 4: Content Generation
- [ ] Keep GitHub Actions for `/generate`
- [ ] Sync generated drafts to D1
- [ ] Notify via Telegram when ready

---

## Benefits

| Metric | Before | After |
|--------|--------|-------|
| Response time | 30-60s | **~100ms** |
| UX | Multiple messages | **Single dashboard** |
| Reliability | Depends on GH Actions | **Edge-first** |
| Cost | Free | **Free** (D1 free tier) |

---

## File Structure Changes

```
cloudflare-worker/
├── src/
│   ├── index.ts          # Main entry, routing
│   ├── views/
│   │   ├── home.ts       # Welcome/dashboard view
│   │   ├── drafts.ts     # Draft list view
│   │   ├── draft.ts      # Single draft view
│   │   ├── stats.ts      # Statistics view
│   │   └── help.ts       # Help view
│   ├── handlers/
│   │   ├── message.ts    # Text message handler
│   │   └── callback.ts   # Button callback handler
│   ├── services/
│   │   ├── telegram.ts   # Telegram API
│   │   ├── database.ts   # D1 operations
│   │   └── x.ts          # X API (for publishing)
│   └── utils/
│       └── keyboard.ts   # Inline keyboard builders
└── wrangler.toml         # D1 binding config
```

---

## Questions Resolved

1. **Main entry**: Welcome message with dashboard
2. **Button layout**: 2-3 per row based on screen
3. **Migration**: Full edge-first with D1 database
