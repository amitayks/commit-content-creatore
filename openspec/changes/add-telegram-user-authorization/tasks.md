# Tasks: Add Telegram User Authorization & Security Hardening

## 1. Telegram Webhook Authorization
- [x] 1.1 Add `getUserIdFromUpdate()` helper to extract user ID from any update type
- [x] 1.2 Add `isAuthorizedUser()` helper function comparing against `TELEGRAM_CHAT_ID`
- [x] 1.3 Add authorization check in `handleTelegramWebhook()` BEFORE processing any update type
- [x] 1.4 Return "unauthorized" message for rejected message updates
- [x] 1.5 Answer callback with error for rejected callback_query updates
- [x] 1.6 Handle potential inline_query updates (future-proofing)

## 2. Database Schema Migration
- [x] 2.1 Add `chat_id` column to `drafts` table
- [x] 2.2 Add `chat_id` column to `repos` table
- [x] 2.3 Add `chat_id` column to `published` table
- [x] 2.4 Create migration script to populate existing records with `TELEGRAM_CHAT_ID`
- [x] 2.5 Add index on `chat_id` for all tables

## 3. Database Service - Read Operations
- [x] 3.1 Update `getDraft()` to require and filter by `chat_id`
- [x] 3.2 Update `getAllDrafts()` to require and filter by `chat_id`
- [x] 3.3 Update `countDrafts()` to require and filter by `chat_id`
- [x] 3.4 Update `getRepo()` to require and filter by `chat_id`
- [x] 3.5 Update `getRepos()` to require and filter by `chat_id`
- [x] 3.6 Update `getRepoByOwnerRepo()` to require and filter by `chat_id`
- [x] 3.7 Update `getWatchingRepos()` to require and filter by `chat_id`
- [x] 3.8 Update `getPublishedByPR()` to require and filter by `chat_id`

## 4. Database Service - Write Operations
- [x] 4.1 Update `createDraft()` to require and store `chat_id`
- [x] 4.2 Update `updateDraft()` to verify `chat_id` ownership
- [x] 4.3 Update `updateDraftStatus()` to verify `chat_id` ownership
- [x] 4.4 Update `updateDraftContent()` to verify `chat_id` ownership
- [x] 4.5 Update `deleteDraft()` to verify `chat_id` ownership
- [x] 4.6 Update `scheduleDraft()` to verify `chat_id` ownership
- [x] 4.7 Update `createRepo()` to require and store `chat_id`
- [x] 4.8 Update `updateRepo()` to verify `chat_id` ownership
- [x] 4.9 Update `deleteRepo()` to verify `chat_id` ownership
- [x] 4.10 Update `createPublished()` to require and store `chat_id`

## 5. Handler Updates
- [x] 5.1 Update `message.ts` handlers to pass `chatId` to all db functions
- [x] 5.2 Update `callback.ts` handlers to pass `chatId` to all db functions
- [x] 5.3 Update `github-webhook.ts` to use watched repo's `chat_id` for auto-created drafts
- [x] 5.4 Update `cron.ts` to handle `chat_id` in scheduled publishing
- [x] 5.5 Update view renderers to pass `chatId` where needed

## 6. Admin Endpoint Protection
- [x] 6.1 Add `ADMIN_SECRET` to environment variables in `types.ts`
- [x] 6.2 Create `verifyAdminSecret()` helper with timing-safe comparison
- [x] 6.3 Add auth check to `/setup` endpoint - require `X-Admin-Secret` header
- [x] 6.4 Add auth check to `/migrate` endpoint - require `X-Admin-Secret` header
- [x] 6.5 Return 401 Unauthorized for invalid/missing admin secret
- [x] 6.6 Add `ADMIN_SECRET` to wrangler.toml secrets documentation
- [x] 6.7 Generate and configure `ADMIN_SECRET` in Cloudflare dashboard (deployment task)

## 7. R2 Image Access Control
- [x] 7.1 Add image key validation to prevent path traversal (`..`, absolute paths)
- [x] 7.2 Implement signed URL generation for R2 images
- [x] 7.3 Update Telegram image sending to use signed URLs
- [x] 7.4 Add expiration time to signed URLs (e.g., 1 hour)
- [x] 7.5 Remove or protect direct `/image/*` endpoint
- [x] 7.6 Update `callback.ts` photo sending to use signed URLs

## 8. Cryptographic Security
- [x] 8.1 Create `timingSafeEqual()` helper using `crypto.subtle.timingSafeEqual`
- [x] 8.2 Update `verifyWebhookSignature()` in `webhook.ts` to use timing-safe comparison
- [x] 8.3 Update admin secret verification to use timing-safe comparison
- [x] 8.4 Audit all other secret comparisons in codebase

## 9. Rate Limiting
- [x] 9.1 Research Cloudflare Rate Limiting options (using in-memory for single worker)
- [x] 9.2 Implement rate limiter for `/webhook` endpoint (100 req/min)
- [x] 9.3 Implement stricter rate limiter for `/setup` and `/migrate` (5 req/min)
- [x] 9.4 Implement rate limiter for `/image/*` endpoint (50 req/min)
- [x] 9.5 Return 429 Too Many Requests when limit exceeded
- [x] 9.6 Add rate limit headers to responses (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset)

## 10. Error Handling & Information Disclosure
- [x] 10.1 Create `sanitizeError()` helper to strip sensitive info from errors
- [x] 10.2 Update `index.ts` catch blocks to use sanitized error messages
- [x] 10.3 Update `message.ts` to return generic errors to users
- [x] 10.4 Update `callback.ts` to return generic errors to users
- [x] 10.5 Update `github-webhook.ts` to sanitize error responses
- [x] 10.6 Update `cron.ts` to sanitize notification error messages
- [x] 10.7 Ensure no API keys/tokens appear in error messages
- [x] 10.8 Create safe error messages for common failure scenarios

## 11. Security Headers
- [x] 11.1 Create `addSecurityHeaders()` helper function
- [x] 11.2 Add `X-Content-Type-Options: nosniff` to all responses
- [x] 11.3 Add `X-Frame-Options: DENY` to all responses
- [x] 11.4 Update image endpoint `Cache-Control` to shorter duration (1 hour)
- [x] 11.5 Add `private` directive to draft image responses
- [x] 11.6 Apply security headers to all response paths in `index.ts`

## 12. Secure Logging
- [x] 12.1 Audit all `console.log` statements for sensitive data
- [x] 12.2 Remove or redact API keys/tokens from logs
- [x] 12.3 Remove or redact full webhook payloads from logs
- [x] 12.4 Keep only necessary identifiers (update_id, not full content)
- [x] 12.5 Create `safeLog()` helper that redacts sensitive fields

## 13. Testing - Telegram Authorization
- [ ] 13.1 Test authorized user can send text messages
- [ ] 13.2 Test authorized user can use all slash commands
- [ ] 13.3 Test authorized user can click inline buttons
- [ ] 13.4 Test unauthorized user gets rejected on messages
- [ ] 13.5 Test unauthorized user gets rejected on commands
- [ ] 13.6 Test unauthorized user gets rejected on button clicks

## 14. Testing - Database Layer
- [ ] 14.1 Test drafts are created with correct `chat_id`
- [ ] 14.2 Test drafts query only returns user's own drafts
- [ ] 14.3 Test draft update fails for wrong `chat_id`
- [ ] 14.4 Test repos are created with correct `chat_id`
- [ ] 14.5 Test repos query only returns user's own repos
- [ ] 14.6 Test repo update fails for wrong `chat_id`

## 15. Testing - Admin Endpoints
- [x] 15.1 Test `/setup` without secret returns 401
- [x] 15.2 Test `/setup` with valid secret succeeds
- [x] 15.3 Test `/migrate` without secret returns 401
- [x] 15.4 Test `/migrate` with valid secret succeeds
- [x] 15.5 Test rate limiting on admin endpoints

## 16. Testing - Image Security
- [ ] 16.1 Test path traversal attempts are blocked
- [ ] 16.2 Test signed URLs work for valid images
- [ ] 16.3 Test expired signed URLs are rejected
- [ ] 16.4 Test unsigned requests are rejected

## 17. Testing - Security Features
- [ ] 17.1 Test rate limiting triggers 429 responses
- [ ] 17.2 Test error messages don't contain sensitive info
- [x] 17.3 Test security headers are present on responses
- [x] 17.4 Verify timing-safe comparison is used (code review)

## 18. GitHub Webhook Security
- [x] 18.1 Verify `verifyWebhookSignature()` uses timing-safe comparison
- [x] 18.2 Ensure missing `X-Hub-Signature-256` header rejects request
- [x] 18.3 Ensure invalid signature rejects request with 401
- [x] 18.4 Validate `X-GitHub-Event` header before processing
- [x] 18.5 Only process expected event types (`pull_request`, `push`)
- [x] 18.6 Validate repository against watched repos before creating drafts
- [x] 18.7 Handle malformed webhook payloads gracefully
- [x] 18.8 Ensure `GITHUB_TOKEN` never appears in logs or responses
- [x] 18.9 Ensure webhook URL uses HTTPS only (Cloudflare enforces this)
- [x] 18.10 Document `GITHUB_WEBHOOK_SECRET` requirements in wrangler.toml
- [x] 18.11 Worker URL derived from request origin (no hardcoded URL)

## 19. GitHub API Security
- [x] 19.1 Audit GitHub API error handling for token exposure
- [x] 19.2 Handle 403 rate limit errors gracefully (sanitized error)
- [x] 19.3 Handle 401 authentication errors without revealing token
- [x] 19.4 Handle 404 errors with safe user messages
- [x] 19.5 Ensure all GitHub API calls use HTTPS (api.github.com)
- [x] 19.6 Document minimum required token scopes in wrangler.toml
- [x] 19.7 Sanitize commit messages before storage (limit size via sanitizeContent)
- [x] 19.8 Handle large diffs appropriately (truncate if needed via sanitizeContent)

## 20. Cloudflare Worker Security
- [x] 20.1 Add `X-XSS-Protection: 1; mode=block` header to responses
- [x] 20.2 Ensure unknown routes return 404 without info leakage
- [x] 20.3 Validate JSON request bodies before processing
- [x] 20.4 Add request body size limits to prevent resource exhaustion
- [x] 20.5 Handle unexpected Content-Type headers gracefully (JSON validation)
- [x] 20.6 Remove or mask `Server` header from responses
- [x] 20.7 Ensure no internal version info in response headers

## 21. D1 Database Security
- [x] 21.1 Audit all SQL queries for parameterized statements
- [x] 21.2 Verify no string concatenation in SQL queries
- [x] 21.3 Sanitize database error messages before returning to users
- [x] 21.4 Ensure table names/schema not revealed in errors

## 22. R2 Storage Security
- [x] 22.1 Validate R2 keys: only allow alphanumeric, dash, underscore, slash
- [x] 22.2 Reject keys with `..` path traversal
- [x] 22.3 Reject absolute paths in R2 keys
- [x] 22.4 Validate content type on R2 uploads (images only via isValidImageContentType)
- [x] 22.5 Enforce file size limits on R2 uploads (10MB via isValidFileSize)
- [x] 22.6 Ensure R2 metadata not exposed to users (only contentType returned)

## 23. Cron Job Security
- [x] 23.1 Ensure cron jobs use configured `TELEGRAM_CHAT_ID`
- [x] 23.2 Ensure cron-created data has proper ownership
- [x] 23.3 Sanitize error notifications sent by cron jobs
- [x] 23.4 Ensure cron errors don't affect other scheduled tasks

## 24. Testing - GitHub Security
- [ ] 24.1 Test webhook with valid signature succeeds
- [ ] 24.2 Test webhook with invalid signature returns 401
- [ ] 24.3 Test webhook with missing signature returns 401
- [ ] 24.4 Test unexpected event types are ignored safely
- [ ] 24.5 Test malformed payload handling
- [ ] 24.6 Test events from unwatched repos are ignored

## 25. Testing - Cloudflare Worker Security
- [x] 25.1 Test unknown routes return 404
- [ ] 25.2 Test invalid JSON body returns 400
- [x] 25.3 Test security headers present on all responses
- [ ] 25.4 Test no sensitive info in error responses
- [x] 25.5 Test R2 path traversal attempts blocked
- [x] 25.6 Test R2 invalid key formats rejected

## 26. Deployment
- [x] 26.1 Add `ADMIN_SECRET` to Cloudflare secrets (`wrangler secret put ADMIN_SECRET`)
- [x] 26.2 Verify `TELEGRAM_CHAT_ID` is configured
- [ ] 26.3 Verify `GITHUB_WEBHOOK_SECRET` is strong (regenerate if needed)
- [x] 26.4 Run database migration on production D1
- [x] 26.5 Deploy updated worker (`wrangler deploy`)
- [ ] 26.6 Test all endpoints with authorized account
- [ ] 26.7 Test rejection with unauthorized Telegram account
- [x] 26.8 Test admin endpoints with secret
- [ ] 26.9 Test GitHub webhook with valid/invalid signatures
- [x] 26.10 Verify rate limiting is active
- [ ] 26.11 Monitor logs for any security issues
- [ ] 26.12 Run security scan against deployed worker

---

## Summary

### Implementation Complete ✅ (108 tasks)

| Section | Description | Status |
|---------|-------------|--------|
| 1 | Telegram Webhook Authorization | 6/6 ✅ |
| 2 | Database Schema Migration | 5/5 ✅ |
| 3 | Database Service - Read Operations | 8/8 ✅ |
| 4 | Database Service - Write Operations | 10/10 ✅ |
| 5 | Handler Updates | 5/5 ✅ |
| 6 | Admin Endpoint Protection | 7/7 ✅ |
| 7 | R2 Image Access Control | 6/6 ✅ |
| 8 | Cryptographic Security | 4/4 ✅ |
| 9 | Rate Limiting | 6/6 ✅ |
| 10 | Error Handling & Information Disclosure | 8/8 ✅ |
| 11 | Security Headers | 6/6 ✅ |
| 12 | Secure Logging | 5/5 ✅ |
| 18 | GitHub Webhook Security | 11/11 ✅ |
| 19 | GitHub API Security | 8/8 ✅ |
| 20 | Cloudflare Worker Security | 7/7 ✅ |
| 21 | D1 Database Security | 4/4 ✅ |
| 22 | R2 Storage Security | 6/6 ✅ |
| 23 | Cron Job Security | 4/4 ✅ |

### Testing & Deployment Progress

| Section | Description | Completed | Total |
|---------|-------------|-----------|-------|
| 13 | Testing - Telegram Authorization | 0 | 6 |
| 14 | Testing - Database Layer | 0 | 6 |
| 15 | Testing - Admin Endpoints | 5 | 5 ✅ |
| 16 | Testing - Image Security | 0 | 4 |
| 17 | Testing - Security Features | 2 | 4 |
| 24 | Testing - GitHub Security | 0 | 6 |
| 25 | Testing - Cloudflare Worker Security | 4 | 6 |
| 26 | Deployment | 6 | 12 |

### Files Modified

| File | Changes |
|------|---------|
| `src/types.ts` | Added ADMIN_SECRET to Env interface |
| `src/services/security.ts` | NEW: Authorization, rate limiting, secure logging, validation utilities |
| `src/services/db.ts` | All functions require chatId, ownership verification |
| `src/services/webhook.ts` | Timing-safe signature verification, secure logging |
| `src/services/grok.ts` | Secure logging, content sanitization, file size validation |
| `src/index.ts` | Authorization, rate limiting, secure logging |
| `src/handlers/message.ts` | ChatId passing, secure logging |
| `src/handlers/callback.ts` | ChatId passing, secure logging |
| `src/handlers/github-webhook.ts` | ChatId from repo, secure logging |
| `src/handlers/cron.ts` | ChatId from draft, secure logging |
| `src/views/index.ts` | ChatId parameter for all views |
| `wrangler.toml` | Secrets documentation and security notes |

### Security Features Implemented

1. **Dual-Layer Authorization**
   - Webhook layer: Rejects unauthorized Telegram users before processing
   - Database layer: All queries filter by chat_id ownership

2. **Rate Limiting**
   - `/webhook`: 100 req/min
   - `/github-webhook`: 30 req/min
   - `/setup`, `/migrate`: 5 req/min
   - `/image/*`: 50 req/min

3. **Cryptographic Security**
   - Timing-safe comparisons for all secret verification
   - HMAC-SHA256 for GitHub webhook signatures
   - Signed URLs for R2 image access

4. **Secure Logging**
   - Automatic redaction of tokens, API keys, secrets
   - Pattern-based sensitive data detection
   - No full payloads or URLs logged

5. **Input Validation**
   - R2 key validation (path traversal prevention)
   - Image content type validation
   - File size limits (10MB max)
   - Content sanitization for AI prompts

6. **Security Headers**
   - X-Content-Type-Options: nosniff
   - X-Frame-Options: DENY
   - X-XSS-Protection: 1; mode=block
   - Rate limit headers on all responses

### Deployment Checklist

```bash
# 1. Generate and set ADMIN_SECRET
openssl rand -hex 32
wrangler secret put ADMIN_SECRET

# 2. Verify other secrets are set
wrangler secret list

# 3. Run database migration
curl -X POST https://your-worker.workers.dev/migrate \
  -H "X-Admin-Secret: YOUR_ADMIN_SECRET"

# 4. Deploy
wrangler deploy

# 5. Test authorization
# Send message from unauthorized Telegram account - should be rejected
# Send message from authorized account - should work

# 6. Test rate limiting
# Make 6 requests to /setup in 1 minute - 6th should return 429
```
