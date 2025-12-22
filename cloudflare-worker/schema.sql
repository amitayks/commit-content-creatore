-- Content Tracker D1 Schema

-- Drafts table
CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'approved', 'rejected', 'published')),
  content TEXT NOT NULL, -- JSON: {format, tweets}
  source TEXT NOT NULL,  -- JSON: {type, url, ref, commits}
  telegram_message_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Chat state for dashboard
CREATE TABLE IF NOT EXISTS chat_state (
  chat_id TEXT PRIMARY KEY,
  dashboard_message_id INTEGER,
  current_view TEXT DEFAULT 'home',
  selected_draft_id TEXT,
  awaiting_input TEXT, -- null, 'commit_sha', 'edit_text'
  context TEXT, -- JSON for additional state
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Published archive
CREATE TABLE IF NOT EXISTS published (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  tweet_ids TEXT NOT NULL, -- JSON array
  tweet_url TEXT,
  published_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_drafts_status ON drafts(status);
CREATE INDEX IF NOT EXISTS idx_drafts_project ON drafts(project_id);
CREATE INDEX IF NOT EXISTS idx_published_project ON published(project_id);
