# Tasks: Rebuild Cloudflare Telegram Bot

## Phase 1: Foundation (Fresh Start)
> Delete existing cloudflare-worker folder and start clean

- [ ] 1.1 **Scaffold new worker project**
  - Run `npm create cloudflare@latest cloudflare-bot`
  - Configure wrangler.toml with D1 binding
  - Add TypeScript strict mode
  - **Verify**: `npm run dev` starts without errors

- [ ] 1.2 **Create D1 database and schema**
  - Create database: `wrangler d1 create content-bot-db`
  - Write schema.sql with drafts, chat_state, published tables
  - Apply migration: `wrangler d1 execute --remote --file=schema.sql`
  - **Verify**: Tables exist via `wrangler d1 execute --remote`

- [ ] 1.3 **Setup environment secrets**
  - Add: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
  - Add: GITHUB_TOKEN, GITHUB_REPO
  - Add: GROK_API_KEY
  - Add: X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET
  - **Verify**: `wrangler secret list` shows all 8 secrets

---

## Phase 2: Core Services

- [ ] 2.1 **Database service (src/services/db.ts)**
  - getDraft, getAllDrafts, createDraft, updateDraft, deleteDraft
  - getChatState, updateChatState
  - createPublished, getPublishedByPR
  - **Verify**: Unit-testable with mock D1

- [ ] 2.2 **GitHub service (src/services/github.ts)**
  - getCommit(sha) → commit details
  - getPRForCommit(sha) → PR number, title, all commits
  - getPR(number) → PR details with diff stats
  - **Verify**: Fetch real commit returns data

- [ ] 2.3 **Grok service (src/services/grok.ts)**
  - generateContent(prData) → tweet thread JSON
  - generateImage(prompt) → image URL or base64
  - **Verify**: Generate returns valid tweet array

- [ ] 2.4 **X service (src/services/x.ts)**
  - uploadMedia(imageBuffer) → media_id
  - postTweet(text, options) → tweet_id
  - postThread(tweets, mediaId?) → { tweetIds, url }
  - deleteTweet(id)
  - **Verify**: Post test tweet succeeds

- [ ] 2.5 **Telegram service (src/services/telegram.ts)**
  - sendMessage(chatId, text, keyboard?)
  - editMessage(chatId, messageId, text, keyboard?)
  - answerCallback(callbackId, text?)
  - **Verify**: Send test message to chat

---

## Phase 3: Bot Views & Handlers

- [ ] 3.1 **View renderers (src/views/)**
  - renderHome() → status dashboard with 6 buttons
  - renderDraftsList(page) → paginated draft cards
  - renderDraftDetail(draft) → full draft with action buttons
  - renderHelp() → command documentation
  - renderGeneratePrompt() → "Send commit SHA" message
  - renderSchedulePrompt() → scheduling UI
  - renderDeleteSearch() → delete by SHA prompt
  - **Verify**: Each view returns valid { text, keyboard }

- [ ] 3.2 **Message handler (src/handlers/message.ts)**
  - /start → renderHome
  - /generate [sha] → start generation flow
  - /approve → publish all approved
  - /drafts → renderDraftsList
  - /help → renderHelp
  - /schedule [sha] → schedule flow
  - /delete [sha] → delete flow
  - Plain text → context-aware handling
  - **Verify**: Each command responds correctly

- [ ] 3.3 **Callback handler (src/handlers/callback.ts)**
  - view:home, view:drafts, view:help
  - draft:{id} → show draft detail
  - action:approve:{id}, action:reject:{id}
  - action:regenerate:{id}, action:schedule:{id}
  - page:{n} → pagination
  - delete:{id} → confirm delete
  - **Verify**: Button clicks update message

---

## Phase 4: Core Workflows

- [ ] 4.1 **Generate workflow**
  - Receive commit SHA → fetch PR from GitHub
  - Call Grok to generate content
  - Save draft to D1
  - Update Telegram with draft preview
  - **Verify**: `/generate <sha>` creates draft

- [ ] 4.2 **Approve & Publish workflow**
  - Mark draft as approved
  - Generate image via Grok
  - Upload image to X
  - Post thread with image
  - Save to published table
  - Update Telegram with success message
  - **Verify**: Approve button publishes to X

- [ ] 4.3 **Schedule workflow**
  - Accept commit SHA + datetime
  - Generate draft immediately
  - Set status = 'scheduled' with scheduled_at
  - **Verify**: Draft shows scheduled status

- [ ] 4.4 **Delete workflow**
  - Search published by commit SHA
  - Show matching posts
  - On confirm, delete tweets from X
  - Remove from published table
  - **Verify**: Delete removes from X

---

## Phase 5: Cron & Polish

- [ ] 5.1 **Scheduled publisher cron**
  - Configure cron trigger in wrangler.toml
  - Query drafts where scheduled_at <= now
  - Publish each and update status
  - **Verify**: Scheduled post publishes on time

- [ ] 5.2 **Error handling & edge cases**
  - Handle Grok timeouts gracefully
  - Handle X rate limits with retry
  - Handle Telegram "message not modified"
  - Show user-friendly error messages
  - **Verify**: Errors show helpful feedback

- [ ] 5.3 **Cleanup old worker code**
  - Remove old cloudflare-worker/ folder
  - Update GitHub Actions to remove generate-content
  - Update README with new setup instructions
  - **Verify**: No orphan code remains

---

## Phase 6: Deployment & Validation

- [ ] 6.1 **Deploy to production**
  - `wrangler deploy`
  - Set Telegram webhook via /setup endpoint
  - **Verify**: Bot responds to /start

- [ ] 6.2 **End-to-end testing**
  - Test /generate with real commit
  - Test approve → publish flow
  - Test scheduling
  - Test delete
  - **Verify**: All workflows work

- [ ] 6.3 **Documentation**
  - Update cloudflare-bot/README.md
  - Document all environment variables
  - Document database schema
  - **Verify**: New developer can set up
