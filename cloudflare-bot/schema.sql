-- Content Bot Database Schema

-- Drafts table
CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  pr_number INTEGER NOT NULL,
  pr_title TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  content TEXT NOT NULL,
  image_url TEXT,
  scheduled_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Chat state for Telegram UI
CREATE TABLE IF NOT EXISTS chat_state (
  chat_id TEXT PRIMARY KEY,
  message_id INTEGER,
  current_view TEXT DEFAULT 'home',
  context TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Published posts archive
CREATE TABLE IF NOT EXISTS published (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL,
  pr_number INTEGER NOT NULL,
  tweet_ids TEXT NOT NULL,
  tweet_url TEXT,
  image_url TEXT,
  published_at TEXT DEFAULT (datetime('now'))
);

-- Watched repos for auto-detection
CREATE TABLE IF NOT EXISTS repos (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  is_watching INTEGER DEFAULT 1,
  config TEXT NOT NULL,
  webhook_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(owner, repo)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_drafts_status ON drafts(status);
CREATE INDEX IF NOT EXISTS idx_drafts_pr ON drafts(pr_number);
CREATE INDEX IF NOT EXISTS idx_published_pr ON published(pr_number);
CREATE INDEX IF NOT EXISTS idx_repos_watching ON repos(is_watching);
