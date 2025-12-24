# GitHub Webhook Integration Capability

## Overview
Receive and process GitHub webhook events for watched repositories, triggering auto-detection of new commits and merged PRs.

## ADDED Requirements

### Requirement: Webhook Endpoint
The worker exposes an endpoint to receive GitHub webhook events.

#### Scenario: Valid webhook received
- **Given**: A webhook is configured for a watched repo
- **When**: GitHub sends a POST to `/github-webhook`
- **And**: The signature is valid
- **Then**: The event is processed
- **And**: Response is 200 OK

#### Scenario: Invalid signature rejected
- **Given**: A request is sent to `/github-webhook`
- **When**: The `X-Hub-Signature-256` header is invalid
- **Then**: Response is 401 Unauthorized
- **And**: Event is not processed

#### Scenario: Webhook for non-watched repo
- **Given**: A webhook event is received
- **When**: The repo is not in the watched list
- **Then**: Event is ignored
- **And**: Response is 200 OK (no error to GitHub)

---

### Requirement: PR Merge Auto-Detection
When a PR is merged on a watched repo, content is auto-generated.

#### Scenario: PR merged triggers generation
- **Given**: Repo `owner/repo` is being watched
- **When**: GitHub sends `pull_request` event with `action: closed` and `merged: true`
- **Then**: Bot fetches PR details
- **And**: Generates content using Grok
- **And**: Creates a draft with status "draft"
- **And**: Sends notification to Telegram

#### Scenario: PR closed without merge ignored
- **Given**: Repo is being watched
- **When**: GitHub sends `pull_request` event with `action: closed` and `merged: false`
- **Then**: Event is ignored (no content generated)

---

### Requirement: Push Auto-Detection
When commits are pushed to a watched branch, content can be auto-generated.

#### Scenario: Push to main triggers generation
- **Given**: Repo is being watched with `branches: ["main"]`
- **When**: GitHub sends `push` event to `refs/heads/main`
- **Then**: Bot fetches commit details
- **And**: Generates content from commit(s)
- **And**: Creates a draft
- **And**: Sends notification to Telegram

#### Scenario: Push to non-watched branch ignored
- **Given**: Repo is being watched with `branches: ["main"]`
- **When**: GitHub sends `push` event to `refs/heads/feature-branch`
- **Then**: Event is ignored

---

### Requirement: Telegram Notification for Auto-Generated Content
Users are notified when content is auto-generated.

#### Scenario: Notification sent on auto-generation
- **Given**: Content was auto-generated from a webhook event
- **When**: Draft is created
- **Then**: Bot sends message to TELEGRAM_CHAT_ID with:
  - Event type (PR merged / Push)
  - Repo name and PR/commit title
  - Quick action buttons

#### Scenario: Quick approve from notification
- **Given**: User received auto-generation notification
- **When**: User clicks "✅ Approve"
- **Then**: Draft status is set to "approved"
- **And**: Message updates to show approved state

#### Scenario: View draft from notification
- **Given**: User received auto-generation notification
- **When**: User clicks "👀 View"
- **Then**: Message updates to show full draft preview

#### Scenario: Skip auto-generated content
- **Given**: User received auto-generation notification
- **When**: User clicks "❌ Skip"
- **Then**: Draft status is set to "rejected"
- **And**: Message updates to confirm skipped

---

### Requirement: Webhook Creation
Webhooks are automatically created when adding a repo.

#### Scenario: Create webhook on repo add
- **Given**: User adds repo `owner/repo`
- **When**: Repo is validated successfully
- **Then**: Bot calls GitHub API to create webhook
- **And**: Webhook URL is `https://<worker-url>/github-webhook`
- **And**: Webhook ID is stored in database

#### Scenario: Webhook creation fails
- **Given**: User adds repo `owner/repo`
- **When**: GitHub API returns error (e.g., no admin access)
- **Then**: Bot shows error message
- **And**: Repo is not added to database

---

### Requirement: Webhook Deletion
Webhooks are removed when deleting a watched repo.

#### Scenario: Delete webhook on repo delete
- **Given**: User deletes watched repo
- **When**: Repo has a stored webhook_id
- **Then**: Bot calls GitHub API to delete the webhook
- **And**: Repo is removed from database

#### Scenario: Webhook already deleted externally
- **Given**: User deletes watched repo
- **When**: Webhook was already deleted on GitHub
- **Then**: Bot handles 404 gracefully
- **And**: Repo is still removed from database
