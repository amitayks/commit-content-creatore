# Project Context

## Purpose
Automate the creation and publishing of social media content (X/Twitter) based on GitHub commits and PRs. The system monitors repository activity, generates engaging content using AI, and provides a Telegram bot interface for approval and management.

## Tech Stack
- **Runtime**: Cloudflare Workers (edge compute)
- **Database**: Cloudflare D1 (SQLite)
- **Language**: TypeScript
- **AI**: Grok API (text & image generation)
- **Platforms**: X (Twitter) API, Telegram Bot API, GitHub API

## Project Conventions

### Code Style
- TypeScript strict mode
- Biome for linting/formatting
- Functional approach where possible
- Explicit error handling with try/catch

### Architecture Patterns
- Edge-first: All processing happens on Cloudflare Workers
- Single-message UI: Telegram bot updates one message instead of spamming
- API-driven: All external interactions via REST APIs.

### Testing Strategy
- Manual testing via Telegram bot interactions
- Wrangler tail for real-time log monitoring

### Git Workflow
- Feature branches merged via PR
- Conventional commits preferred

## Domain Context
- **Draft**: Generated content waiting for approval
- **Commit SHA**: Unique identifier, can belong to a PR
- **PR**: Pull request containing one or more commits
- **Thread**: Multi-tweet post on X

## Important Constraints
- Cloudflare Workers free tier: 10ms CPU time (API waits don't count)
- Telegram messages have 4096 char limit
- X tweets have 280 char limit per tweet

## External Dependencies
- Grok API: Text and image generation
- X API v2: Posting tweets with media
- Telegram Bot API: Webhook-based interactions
- GitHub API: Fetching commit/PR data
