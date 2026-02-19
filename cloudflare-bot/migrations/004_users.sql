-- Migration 004: Create users table (replaces chat_state)
-- Multi-tenant Phase 1: user identity, encrypted keys, settings, UI state

CREATE TABLE IF NOT EXISTS users (
    chat_id TEXT PRIMARY KEY,
    username TEXT,
    display_name TEXT,
    status TEXT DEFAULT 'onboarding',
    onboarding_step TEXT,

    -- Encrypted API keys (AES-256-GCM, base64-encoded)
    gemini_key_enc TEXT,
    x_api_key_enc TEXT,
    x_api_secret_enc TEXT,
    x_access_token_enc TEXT,
    x_access_secret_enc TEXT,
    github_token_enc TEXT,
    heygen_api_key_enc TEXT,

    -- Feature flags
    has_gemini INTEGER DEFAULT 0,
    has_x INTEGER DEFAULT 0,
    has_github INTEGER DEFAULT 0,
    has_heygen INTEGER DEFAULT 0,

    -- UI state (merged from chat_state)
    message_id INTEGER,
    current_view TEXT DEFAULT 'home',
    context TEXT,

    -- Settings (merged from chat_state)
    timezone TEXT DEFAULT 'UTC',
    page_size INTEGER DEFAULT 5,
    video_settings TEXT,

    -- Rate limiting
    daily_generates INTEGER DEFAULT 0,
    daily_reposts INTEGER DEFAULT 0,
    last_reset_date TEXT,
    consecutive_failures INTEGER DEFAULT 0,

    -- Timestamps
    created_at TEXT DEFAULT (datetime('now')),
    last_active_at TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
