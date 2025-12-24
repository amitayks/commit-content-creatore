# Design: Rebuild Cloudflare Telegram Bot

## Architectural Decisions

### 1. Why 100% Cloudflare Workers?

**Decision**: Move all processing from GitHub Actions to Cloudflare Workers.

**Rationale**:
- API calls don't consume CPU time (only ~50ms CPU for entire workflow)
- Free tier (10ms CPU) is sufficient since we're mostly waiting on external APIs
- Instant response vs. 30s+ GitHub Actions cold start
- Simpler architecture (one platform instead of two)

**Trade-offs**:
- ❌ No git operations (must use GitHub API)
- ❌ No file-based draft storage (must use D1)
- ✅ Real-time publishing
- ✅ No commit spam from bot

---

### 2. Conversational Message Flow Pattern

**Decision**: Maintain natural conversational flow - text messages get new responses, button clicks update current message.

**Rationale**:
- Natural conversation: user speaks → bot responds with new message
- Silent UI updates: button clicks don't spam the chat
- Preserves chat history in a readable way
- User always gets feedback for their input

**Rules**:
| User Action | Bot Response |
|-------------|--------------|
| Sends text (`/start`, `/generate sha`, raw SHA) | **NEW message** |
| Clicks button | **EDIT current message** |
| Sends text after button prompt | **NEW message** |

**Implementation**:
```
User sends /start
  → Bot sends NEW dashboard message (ID saved)
  
User clicks "Drafts" button
  → Bot EDITS the dashboard to show drafts list
  
User clicks "Generate" button
  → Bot EDITS dashboard to show "Send commit SHA..."
  → User sends "abc123"
  → Bot sends NEW message with draft preview (becomes new dashboard)
```

**Edge Cases**:
- Message too old to edit → Send new message, update chat_state
- "Message not modified" on button click → Silently succeed

---

### 3. Commit → PR Resolution

**Decision**: All operations resolve commit SHA to parent PR.

**Rationale**:
- Content should represent the full PR, not individual commits
- Users might not remember PR numbers
- Single commit can belong to a PR with multiple commits

**Implementation**:
```typescript
async function getPRForCommit(sha: string): Promise<PR> {
  // 1. Get commit details
  const commit = await github.getCommit(sha);
  
  // 2. Search for PRs containing this commit
  const prs = await github.searchPRs(`${sha} is:merged`);
  
  // 3. Return the first (most recent) PR
  return prs[0];
}
```

---

### 4. Service Layer Structure

**Decision**: Thin service layer with single responsibility per file.

```
src/
├── index.ts           # Worker entry point, routing
├── services/
│   ├── db.ts          # D1 operations
│   ├── github.ts      # GitHub API
│   ├── grok.ts        # AI generation
│   ├── x.ts           # Twitter/X posting
│   └── telegram.ts    # Bot API calls
├── handlers/
│   ├── message.ts     # Text message routing
│   └── callback.ts    # Button click routing
├── views/
│   └── index.ts       # All view renderers
└── types.ts           # Shared TypeScript types
```

**Rationale**:
- Each service has one external dependency
- Easy to mock for testing
- Clear import paths

---

### 5. State Machine for Chat

**Decision**: Use explicit view states stored in D1.

**States**:
```
home           → Main dashboard
drafts         → Draft list (with page number in context)
draft_detail   → Viewing specific draft (draft_id in context)
generate       → Waiting for commit SHA
schedule       → Waiting for commit SHA + time
delete         → Waiting for commit SHA to delete
publishing     → Publishing in progress (prevents double-clicks)
```

**Transitions**:
```
home → drafts (click "Drafts" button)
home → generate (click "Generate" or send /generate)
drafts → draft_detail (click draft card)
draft_detail → home (after approve/reject)
* → home (send /start or click Home)
```

---

### 6. Error Handling Strategy

**Decision**: Graceful degradation with user feedback.

**Patterns**:
```typescript
try {
  await riskyOperation();
} catch (error) {
  console.error('Operation failed:', error);
  
  // Always show something to user
  await telegram.editMessage(chatId, messageId, 
    `❌ Error: ${friendlyMessage(error)}\n\nTap 🏠 to return home.`,
    [[{ text: '🏠 Home', callback_data: 'view:home' }]]
  );
}
```

**Specific Handlers**:
| Error | Handling |
|-------|----------|
| Grok timeout | "Generation taking too long. Try again?" |
| X rate limit | "X is rate limiting. Will retry in 15 min." |
| GitHub 404 | "Commit not found. Check SHA?" |
| Telegram edit failed | Send new message instead |

---

### 7. Database Indexes

**Decision**: Index frequently queried columns.

```sql
CREATE INDEX idx_drafts_status ON drafts(status);
CREATE INDEX idx_drafts_pr ON drafts(pr_number);
CREATE INDEX idx_drafts_scheduled ON drafts(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX idx_published_pr ON published(pr_number);
```

**Rationale**:
- Status queries for "all approved" or "all scheduled"
- PR queries for "delete by commit" workflow
- Scheduled index for cron job efficiency

---

## Alternative Approaches Considered

### A. Keep GitHub Actions for heavy work
**Rejected**: Adds latency, complexity, and commit spam.

### B. Use Cloudflare KV instead of D1
**Rejected**: Need relational queries (by status, by PR). D1 is better fit.

### C. Multiple messages for different views
**Rejected**: Poor UX, message clutter, harder to track state.

### D. Webhook-less polling
**Rejected**: Inefficient, adds latency, wastes resources.
