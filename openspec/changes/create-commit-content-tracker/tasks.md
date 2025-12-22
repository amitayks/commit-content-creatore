# Tasks: Commit Content Tracker Implementation

## Phase 1: Project Foundation

- [ ] 1.1 Initialize monorepo with TypeScript, Biome
- [ ] 1.2 Set up project structure (src/, config/, data/, .github/)
- [ ] 1.3 Create base types (Draft, Tweet, ProjectConfig, GitHubEvent)
- [ ] 1.4 Implement logger utility (Winston-based, like bitbucket-pr-reviewer)
- [ ] 1.5 Implement retry utility with exponential backoff
- [ ] 1.6 Create constants file for configuration values

## Phase 2: GitHub Integration

- [ ] 2.1 Create GitHub webhook handler workflow (.github/workflows/webhook-handler.yml)
- [ ] 2.2 Implement GitHub service for fetching PR/commit details
- [ ] 2.3 Parse webhook payloads (push, pull_request events)
- [ ] 2.4 Extract diff, commit messages, and file changes
- [ ] 2.5 Filter events based on project configuration (branches, patterns)
- [ ] 2.6 Create sample project config YAML with all options documented

## Phase 3: Storage System

- [ ] 3.1 Implement storage service for JSON file management
- [ ] 3.2 Create draft CRUD operations (create, read, update, list)
- [ ] 3.3 Implement status transitions (draft → approved → published)
- [ ] 3.4 Add atomic file writes to prevent corruption
- [ ] 3.5 Create archive mechanism for published content
- [ ] 3.6 Add cleanup workflow for old archived content

## Phase 4: AI Content Generation

- [ ] 4.1 Implement Grok service with API integration
- [ ] 4.2 Create prompt builder for thread generation
- [ ] 4.3 Create prompt builder for image generation
- [ ] 4.4 Implement content parser to extract structured response
- [ ] 4.5 Add format detection logic (single vs thread)
- [ ] 4.6 Implement character count validation (280 char limit)
- [ ] 4.7 Create content-generator workflow
- [ ] 4.8 Add fallback support for Claude/OpenAI if Grok fails

## Phase 5: Telegram Bot

- [ ] 5.1 Create Telegram bot via BotFather, obtain token (ask user for name and username)
- [ ] 5.2 Implement Telegram service for sending messages
- [ ] 5.3 Create draft preview formatter (styled message)
- [ ] 5.4 Implement inline keyboard (Approve, Reject, Edit, Regenerate)
- [ ] 5.5 Create webhook handler for Telegram callbacks
- [ ] 5.6 Implement approval flow (update draft status on approve)
- [ ] 5.7 Implement rejection flow (mark as rejected, optional reason)
- [ ] 5.8 Implement regeneration flow (trigger new AI call)
- [ ] 5.9 Implement edit flow (receive reply message, update tweet)
- [ ] 5.10 Add queue status command (/queue, /pending, /stats)
- [ ] 5.11 Create telegram-bot workflow for handling updates

## Phase 6: X Publishing

- [ ] 6.1 Implement X service with OAuth 2.0 authentication
- [ ] 6.2 Create tweet posting function (single tweet)
- [ ] 6.3 Create thread posting function (reply chain)
- [ ] 6.4 Implement media upload for AI-generated images
- [ ] 6.5 Add rate limit handling and tracking
- [ ] 6.6 Create publisher workflow (scheduled, processes approved drafts)
- [ ] 6.7 Send confirmation to Telegram after successful publish
- [ ] 6.8 Update draft with published tweet ID

## Phase 7: Integration & Testing

- [ ] 7.1 End-to-end test: push → draft → telegram → approve → publish
- [ ] 7.2 Test PR merge flow
- [ ] 7.3 Test manual trigger flow
- [ ] 7.4 Test error handling and retries
- [ ] 7.5 Test rate limit handling
- [ ] 7.6 Validate multi-project configuration
- [ ] 7.7 Test Telegram bot all buttons and commands

## Phase 8: Documentation & Polish

- [ ] 8.1 Write comprehensive README with setup instructions
- [ ] 8.2 Document all environment variables and secrets
- [ ] 8.3 Create example project configs for different use cases
- [ ] 8.4 Add prompt engineering tips for customization
- [ ] 8.5 Create troubleshooting guide
- [ ] 8.6 Final code cleanup and linting

## Dependencies

- Phase 2 depends on Phase 1
- Phase 3 depends on Phase 1
- Phase 4 depends on Phase 1, 2, 3
- Phase 5 depends on Phase 3
- Phase 6 depends on Phase 3, 5
- Phase 7 depends on all previous phases
- Phase 8 can start after Phase 6

## Parallelizable Work

- Phase 2 and Phase 3 can run in parallel
- Phase 5 can start after Phase 3, independent of Phase 4
- Documentation (Phase 8) can start incrementally during development
