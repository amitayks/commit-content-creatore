/**
 * Application constants and configuration values.
 */

import 'dotenv/config';

/** API Keys and Secrets */
export const API_KEYS = {
  /** xAI Grok API key */
  GROK_API_KEY: process.env.GROK_API_KEY || '',
  /** GitHub Personal Access Token for API access */
  GH_PAT: process.env.GH_PAT || '',
  /** X (Twitter) API credentials */
  X_API_KEY: process.env.X_API_KEY || '',
  X_API_SECRET: process.env.X_API_SECRET || '',
  X_ACCESS_TOKEN: process.env.X_ACCESS_TOKEN || '',
  X_ACCESS_SECRET: process.env.X_ACCESS_SECRET || '',
  /** Telegram bot token */
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  /** Telegram chat ID for notifications */
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || '',
  /** Fallback: Anthropic API key */
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  /** Fallback: OpenAI API key */
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
} as const;

/** AI Model Configuration */
export const AI_CONFIG = {
  /** Primary AI provider */
  PRIMARY_PROVIDER: 'grok' as const,
  /** Fallback providers in order */
  FALLBACK_PROVIDERS: ['anthropic', 'openai'] as const,
  /** Grok model name */
  GROK_MODEL: process.env.GROK_MODEL || 'grok-3',
  /** Anthropic model name */
  ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
  /** OpenAI model name */
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o',
  /** Max tokens for response */
  MAX_TOKENS: 4000,
  /** Temperature for generation */
  TEMPERATURE: 0.7,
} as const;

/** Content Generation Settings */
export const CONTENT_CONFIG = {
  /** Maximum characters per tweet */
  MAX_TWEET_LENGTH: 280,
  /** Maximum tweets in a thread */
  MAX_THREAD_LENGTH: 10,
  /** Debounce wait for push events (minutes) */
  PUSH_DEBOUNCE_MINUTES: 30,
  /** Process PRs immediately */
  PR_IMMEDIATE: true,
  /** Default image probability for single tweets */
  SINGLE_TWEET_IMAGE_PROBABILITY: 0.7,
} as const;

/** Storage Paths */
export const PATHS = {
  /** Drafts storage directory */
  DRAFTS_DIR: 'data/drafts',
  /** Published content archive */
  PUBLISHED_DIR: 'data/published',
  /** Project configs directory */
  PROJECTS_DIR: 'config/projects',
  /** Prompt templates directory */
  PROMPTS_DIR: 'config/prompts',
} as const;

/** Rate Limits */
export const RATE_LIMITS = {
  /** X API monthly tweet limit (free tier) */
  X_MONTHLY_LIMIT: 1500,
  /** X API daily limit */
  X_DAILY_LIMIT: 50,
  /** Telegram messages per minute */
  TELEGRAM_PER_MINUTE: 20,
} as const;

/** Archive Settings */
export const ARCHIVE_CONFIG = {
  /** Days to retain published content */
  RETENTION_DAYS: 90,
  /** Auto cleanup enabled */
  AUTO_CLEANUP: true,
} as const;

/** GitHub Webhook Settings */
export const WEBHOOK_CONFIG = {
  /** Webhook secret for validation */
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET || '',
} as const;

/**
 * Validate that required environment variables are set.
 */
export function validateRequiredEnvVars(): { valid: boolean; missing: string[] } {
  const required = [
    'GROK_API_KEY',
    'GH_PAT',
    'X_API_KEY',
    'X_API_SECRET',
    'X_ACCESS_TOKEN',
    'X_ACCESS_SECRET',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_CHAT_ID',
  ];

  const missing = required.filter((key) => !process.env[key]);

  return {
    valid: missing.length === 0,
    missing,
  };
}
