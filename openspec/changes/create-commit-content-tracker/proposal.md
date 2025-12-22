# Change: Create Commit Content Tracker

## Why

Developers do incredible work daily—solving complex problems, discovering new technologies, building innovative features—but this work often goes unnoticed beyond the commit log. Manual content creation about technical work is time-consuming and inconsistent.

There's an opportunity to automatically transform commits and PRs into engaging X (Twitter) threads that showcase technical expertise, share learnings, and build developer influence—like professional tech influencers do, but powered by AI and automated workflows.

## What Changes

This is a **new project** that combines patterns from two existing projects:
- **bitbucket-pr-reviewer**: Webhook-driven architecture, queue processing, AI integration
- **weatherMan**: Social media publishing, GitHub Actions automation, multi-platform support

### Core Capabilities

1. **GitHub Webhook Integration**
   - Receive webhooks on PR merge, branch push, or manual trigger
   - Extract diff, commit messages, file changes, and repository context
   - Filter events based on project configuration (branches, file patterns)

2. **AI Content Generation (Grok)**
   - Transform code changes into engaging, human-like content
   - Dynamic decision: single tweet vs multi-tweet thread based on scope
   - Generate optional images/visuals for key concepts
   - Per-project tone and style configuration via JSON

3. **Draft Management System**
   - Store generated content in draft state (database/JSON)
   - Support approval workflow: `draft → approved → published → archived`
   - Track content history and regeneration requests

4. **Telegram Bot Interface**
   - Push notifications when new drafts are ready
   - Preview threads with formatted styling
   - Inline buttons: Approve, Reject, Edit, Regenerate
   - Interactive editing via reply messages
   - Queue management and scheduling

5. **X (Twitter) Publishing**
   - Publish approved threads via X API v2
   - Handle rate limits and retry logic
   - Thread creation with proper reply chaining
   - Optional media upload for AI-generated images

6. **Project Configuration**
   - Per-project settings in YAML/JSON files
   - Content type preferences (technical, feature, learning, mixed)
   - Tone/voice settings (professional, casual, technical, etc.)
   - Hashtag and mention templates
   - Project tagging for multi-project single-account publishing

### Key Design Decisions

- **Monorepo architecture**: Built from scratch, combining best patterns from both source projects
- **TypeScript**: Primary language (following bitbucket-pr-reviewer patterns)
- **GitHub Actions**: For webhook receiving and scheduled processing
- **Grok API**: Primary AI provider (with fallback support for Claude/OpenAI)
- **Draft-first workflow**: Nothing published without explicit approval
- **Telegram-native review**: Complete review process without leaving the chat

## Impact

- **Affected specs**: All new capabilities (6 spec files)
- **Affected code**: New monorepo with ~15-20 source files
- **External dependencies**: 
  - GitHub API
  - xAI Grok API
  - X (Twitter) API v2
  - Telegram Bot API
- **Infrastructure**: GitHub Actions (free tier compatible)

## Non-Goals (v1)

- Multi-account X publishing (future enhancement)
- Instagram/TikTok/LinkedIn support (future enhancement)
- Web dashboard (Telegram bot is the primary interface)
- Real-time streaming responses
- Collaborative review (single-user system)
