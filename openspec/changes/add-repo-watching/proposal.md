# Add Repo Watching with GitHub Webhooks

## Overview

Add the ability for users to manage watched repositories from the Telegram bot, with auto-detection of new commits/PRs via GitHub webhooks. Each repo can have custom configuration for content generation.

## Background

Currently, users must manually trigger content generation with `/generate <sha>`. This proposal adds:
1. **Repo management UI** in Telegram bot
2. **GitHub webhook integration** for auto-detection
3. **Per-repo configuration** for content generation settings

## User Review Required

> [!IMPORTANT]
> **GitHub Token Scope**: The existing `GITHUB_TOKEN` must include `admin:repo_hook` permission to programmatically create webhooks.

> [!WARNING]
> **Webhook Secret**: A new `GITHUB_WEBHOOK_SECRET` environment variable is required to verify webhook payloads.

## Proposed Changes

### Database Layer

#### [NEW] Schema changes for watched repos
Add new `repos` table to D1 schema to store watched repo configurations.

---

### Services Layer

#### [MODIFY] [db.ts](file:///Users/ozkeisar/work-content-tracker/cloudflare-bot/src/services/db.ts)
- Add CRUD operations for `repos` table
- Add `RepoConfig` type with watching state and configuration

#### [NEW] [webhook.ts](file:///Users/ozkeisar/work-content-tracker/cloudflare-bot/src/services/webhook.ts)
- Create/delete GitHub webhooks via GitHub API
- Verify webhook signatures using `GITHUB_WEBHOOK_SECRET`

---

### Handlers Layer

#### [MODIFY] [index.ts](file:///Users/ozkeisar/work-content-tracker/cloudflare-bot/src/index.ts)
- Add `/github-webhook` POST endpoint for receiving GitHub events

#### [NEW] [github-webhook.ts](file:///Users/ozkeisar/work-content-tracker/cloudflare-bot/src/handlers/github-webhook.ts)
- Handle `push` and `pull_request` events
- Filter by watched repos and trigger content generation
- Send notification to Telegram for approval

#### [MODIFY] [callback.ts](file:///Users/ozkeisar/work-content-tracker/cloudflare-bot/src/handlers/callback.ts)
- Add `view:repos` handler
- Add `repo:<id>` handler for repo detail view
- Add actions: `watch`, `unwatch`, `delete-repo`, `edit-repo`

#### [MODIFY] [message.ts](file:///Users/ozkeisar/work-content-tracker/cloudflare-bot/src/handlers/message.ts)
- Add `/watch <owner/repo>` command
- Add `/unwatch <owner/repo>` command
- Add `/repos` command
- Handle repo configuration input

---

### Views Layer

#### [MODIFY] [index.ts](file:///Users/ozkeisar/work-content-tracker/cloudflare-bot/src/views/index.ts)
- Add `renderReposList()` - list of watched repos with "Add new" button
- Add `renderRepoDetail()` - repo info with watch/unwatch/delete/edit buttons
- Add `renderRepoConfig()` - configuration editing UI
- Add `renderAddRepo()` - prompt for repo name
- Update `renderHome()` - add "📦 Repos" button

---

### Types

#### [MODIFY] [types.ts](file:///Users/ozkeisar/work-content-tracker/cloudflare-bot/src/types.ts)
- Add `RepoConfig` interface
- Add `WatchedRepo` interface
- Add `GitHubWebhookEvent` type
- Update `Env` to include `GITHUB_WEBHOOK_SECRET`

## Verification Plan

### Manual Testing (via Telegram Bot)
1. Send `/start` → Verify "📦 Repos" button appears on home dashboard
2. Click "📦 Repos" → Verify empty state with "➕ Add repo" button
3. Click "➕ Add repo" → Verify prompt appears
4. Send `owner/repo` → Verify repo added and webhook created on GitHub
5. View repo detail → Verify watch/unwatch/delete/edit buttons
6. Make a commit on watched repo → Verify auto-generation triggers

### Wrangler Tail Logging
- Verify webhook events are received at `/github-webhook`
- Verify signature validation passes/fails appropriately
- Verify content generation is triggered for watched repos
