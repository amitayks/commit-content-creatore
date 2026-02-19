-- Migration: Twitter Repost System
-- Adds new tables for Twitter account following and tweet tracking,
-- plus new columns on the drafts table for repost support.

-- New tables (IF NOT EXISTS for safety)
CREATE TABLE IF NOT EXISTS twitter_accounts (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  username TEXT NOT NULL,
  user_id TEXT,
  display_name TEXT,
  is_watching INTEGER DEFAULT 1,
  last_tweet_id TEXT,
  config TEXT NOT NULL,
  thread_buffer TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(chat_id, username)
);

CREATE TABLE IF NOT EXISTS twitter_account_overviews (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL UNIQUE,
  persona TEXT,
  topics TEXT,
  communication_style TEXT,
  notable_context TEXT,
  recent_themes TEXT,
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS twitter_tweets (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  conversation_id TEXT,
  thread_position INTEGER DEFAULT 0,
  is_thread INTEGER DEFAULT 0,
  text TEXT NOT NULL,
  author_username TEXT NOT NULL,
  metrics TEXT,
  tweet_url TEXT,
  tweeted_at TEXT,
  relevance_score INTEGER,
  relevance_reason TEXT,
  status TEXT DEFAULT 'pending',
  draft_id TEXT,
  batch_message_id INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Add repost columns to drafts table (safe: will error if already exists, which is OK)
ALTER TABLE drafts ADD COLUMN original_tweet_id TEXT;
ALTER TABLE drafts ADD COLUMN original_tweet_url TEXT;

-- New indexes
CREATE INDEX IF NOT EXISTS idx_twitter_accounts_watching ON twitter_accounts(is_watching);
CREATE INDEX IF NOT EXISTS idx_twitter_accounts_chat ON twitter_accounts(chat_id);
CREATE INDEX IF NOT EXISTS idx_twitter_tweets_account ON twitter_tweets(account_id);
CREATE INDEX IF NOT EXISTS idx_twitter_tweets_status ON twitter_tweets(status);
CREATE INDEX IF NOT EXISTS idx_twitter_tweets_conversation ON twitter_tweets(conversation_id);
CREATE INDEX IF NOT EXISTS idx_twitter_tweets_batch ON twitter_tweets(batch_message_id);
CREATE INDEX IF NOT EXISTS idx_drafts_source ON drafts(source);
