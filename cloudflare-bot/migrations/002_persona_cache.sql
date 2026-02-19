-- Migration: Persona Cache
-- Lightweight persona storage for non-followed accounts used in manual reposts.

CREATE TABLE IF NOT EXISTS persona_cache (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  user_id TEXT,
  display_name TEXT,
  bio TEXT,
  persona TEXT,
  topics TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_persona_cache_username ON persona_cache(username);
