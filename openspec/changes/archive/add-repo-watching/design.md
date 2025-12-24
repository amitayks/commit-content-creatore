# Design Decisions

## 1. Webhook Creation Strategy

**Decision**: Create webhooks programmatically via GitHub API when user adds a repo.

**Alternatives Considered**:
- Manual webhook setup by user → Too much friction
- Organization-level webhook → Requires org admin access, not flexible
- Polling via cron → Uses API quota, delayed detection

**Rationale**: Programmatic creation provides the best UX while being scoped to specific repos the user wants to watch.

---

## 2. Configuration Storage

**Decision**: Store repo configuration as JSON in D1 database, not as separate YAML files.

**Alternatives Considered**:
- YAML files in repo (`config/projects/<repo>.yaml`) → Requires file system, not available in Workers
- Separate KV store → Adds complexity, D1 already available

**Rationale**: D1 is already used for other data. Storing config as JSON column keeps everything in one place. The `example.yaml` serves as documentation/template only.

---

## 3. Repo Configuration Schema

**Decision**: Use a simplified subset of the full config YAML for initial implementation.

**Initial Config Properties**:
```typescript
interface RepoConfig {
  // Content generation
  tone: 'professional' | 'casual' | 'technical';
  includeHashtags: boolean;
  
  // Triggers
  watchPRs: boolean;       // Auto-generate on PR merge
  watchPushes: boolean;    // Auto-generate on push to main
  branches: string[];      // Which branches to watch
  
  // Platform
  platform: 'x';           // Future: add 'linkedin', 'threads', etc.
}
```

**Rationale**: Start simple, expand based on user feedback. The full YAML schema is aspirational; we implement a subset first.

---

## 4. Telegram UI Flow

**Decision**: Use the existing single-message-update pattern for repo management.

**Flow**:
```
Home → Repos List → Repo Detail → Action/Edit
                  ↳ Add New Repo → Input prompt
```

**Button Layout**:
```
// Repos List
[➕ Add repo]
[📦 owner/repo1]  [📦 owner/repo2]
[🏠 Home]

// Repo Detail  
[👁 Watching ✓] or [👁 Watch]
[✏️ Edit]  [🗑 Delete]
[◀️ Back]
```

---

## 5. GitHub Webhook Event Handling

**Decision**: Handle `push` and `pull_request` events, filter by merge status.

**Event Processing**:
- `pull_request` with `action: closed` + `merged: true` → Generate content from PR
- `push` to watched branch → Generate content from commit(s)

**Debouncing**: For push events, batch commits within the same push; don't generate per-commit.

---

## 6. Webhook Security

**Decision**: Use HMAC-SHA256 signature verification with a shared secret.

**Implementation**:
1. Store `GITHUB_WEBHOOK_SECRET` in Cloudflare secrets
2. Use same secret when creating all webhooks
3. Verify `X-Hub-Signature-256` header on incoming requests

---

## 7. Auto-Generation Behavior

**Decision**: Auto-generate content AND send for approval; don't auto-publish.

**Rationale**: User should always review before publishing. Auto-detection saves the manual `/generate` step, but approval remains explicit.

**Notification Format**:
```
🔔 New PR Merged!

PR #42: Add user authentication
Repo: owner/repo

I've auto-generated content for this. Review and approve?

[✅ Approve] [👀 View Draft] [❌ Skip]
```
