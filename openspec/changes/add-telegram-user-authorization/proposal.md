# Change: Add Telegram User Authorization

## Why
**CRITICAL SECURITY VULNERABILITIES IDENTIFIED**: Comprehensive security audit found 19 vulnerabilities. The most critical:

1. **No Telegram user authorization** - Any user can access all drafts, repos, publish to X account
2. **Unauthenticated admin endpoints** - `/setup` and `/migrate` are publicly accessible
3. **R2 images publicly accessible** - Draft images can be viewed without authorization
4. **Timing attack vulnerability** - Webhook signature comparison is not constant-time
5. **No rate limiting** - DoS attacks possible on all endpoints
6. **Error messages leak info** - Stack traces and internal details exposed

The database tables (`drafts`, `repos`, `published`) have no `user_id` or `chat_id` column, and all queries return global data without any ownership filtering.

## Attack Vectors (All Must Be Protected)

### Telegram Bot Attacks
1. **Text messages** - User sends any text to the bot
2. **Slash commands** - `/start`, `/generate`, `/drafts`, `/repos`, etc.
3. **Callback queries** - Clicking inline buttons (View, Approve, Publish, etc.)
4. **Inline queries** - If bot supports `@botname` inline mode (future-proofing)

### Direct HTTP Attacks
5. **Admin endpoints** - `/setup` can hijack webhook, `/migrate` can corrupt DB
6. **R2 image enumeration** - `/image/*` exposes draft images without auth
7. **Fake GitHub webhooks** - Timing attack on signature verification
8. **DoS via API abuse** - No rate limiting on any endpoint

Note: Slash commands are just regular messages starting with `/` - they go through the same `message` handler.

## What Changes
Comprehensive security hardening with **defense in depth** across all layers:

### Layer 1: Telegram Webhook Authorization
1. **Extract user ID from all update types**:
   - Messages: from `update.message.from.id` (the sender)
   - Callbacks: from `update.callback_query.from.id` (the button clicker)
   - Inline queries: from `update.inline_query.from.id` (if supported)

2. **Authorization check at webhook entry** - Before ANY handler is called, validate user ID against `TELEGRAM_CHAT_ID`

3. **Reject unauthorized users** - Return a friendly "unauthorized" message, reveal nothing about the bot's functionality

4. **Early exit** - Block unauthorized requests before any data access, state changes, or handler invocation

### Layer 2: Database Service Authorization
5. **Add `chat_id` column to data tables** - `drafts`, `repos`, `published` tables get owner tracking

6. **Filter all queries by `chat_id`** - `getAllDrafts()`, `getRepos()`, etc. require and filter by `chat_id`

7. **Verify ownership on mutations** - `updateDraft()`, `deleteDraft()`, `updateRepo()`, etc. verify `chat_id` matches before modifying

8. **Database migration** - Add `chat_id` column with default value for existing data

### Layer 3: Admin Endpoint Protection
9. **Protect `/setup` endpoint** - Require secret token or remove entirely after initial setup

10. **Protect `/migrate` endpoint** - Require secret token

11. **Add admin secret validation** - New `ADMIN_SECRET` env var for admin operations

### Layer 4: R2 Image Access Control
12. **Signed URLs for images** - Generate time-limited signed URLs instead of direct access

13. **Remove public `/image/*` endpoint** - Or require authentication token

14. **Image key validation** - Prevent path traversal attacks

### Layer 5: Cryptographic Security
15. **Constant-time signature comparison** - Fix timing attack in GitHub webhook verification

16. **Use `crypto.subtle.timingSafeEqual`** - For all secret comparisons

### Layer 6: Rate Limiting & DoS Protection
17. **Implement rate limiting** - Use Cloudflare Rate Limiting or in-memory counters

18. **Per-endpoint limits** - Different limits for webhook vs admin endpoints

### Layer 7: Error Handling & Information Disclosure
19. **Sanitize error messages** - Never expose stack traces or internal paths to users

20. **Generic error responses** - Return safe messages like "An error occurred"

21. **Secure logging** - Audit and reduce sensitive data in console.log

### Layer 8: Security Headers
22. **Add security headers** - X-Content-Type-Options, X-Frame-Options on all responses

23. **Configure Cache-Control** - Shorter cache for draft content

## Impact
- Affected specs: `telegram-bot` (new capability spec)
- Affected code:
  - `cloudflare-bot/src/index.ts` (all endpoints, headers)
  - `cloudflare-bot/src/services/db.ts` (all query functions)
  - `cloudflare-bot/src/services/webhook.ts` (timing-safe comparison)
  - `cloudflare-bot/src/handlers/*.ts` (pass chat_id, error handling)
  - `cloudflare-bot/wrangler.toml` (new secrets)
- Breaking changes: None (existing authorized user unaffected, migration handles existing data)
- Security: Comprehensive defense in depth - 8 security layers
