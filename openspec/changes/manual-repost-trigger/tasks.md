## 1. Types & Schema

- [x] 1.1 Add `'sarcastic'` to the tone union type in `TwitterAccountConfig` in both `cloudflare-bot/src/types.ts` and `twitter-poller/src/types.ts`
- [x] 1.2 Add `'repost_url'` to the `ChatContext.awaiting_input` union type
- [x] 1.3 Add `PersonaCache` interface to `cloudflare-bot/src/types.ts` (id, username UNIQUE, user_id, display_name, bio, persona, topics, created_at, updated_at)
- [x] 1.4 Create migration `cloudflare-bot/migrations/002_persona_cache.sql` with `persona_cache` table (CREATE TABLE IF NOT EXISTS, UNIQUE on username)
- [x] 1.5 Run migration on D1

## 2. Database Service Functions

- [x] 2.1 Add `getPersonaCache(env, username)` to `cloudflare-bot/src/services/db.ts`
- [x] 2.2 Add `upsertPersonaCache(env, username, data)` to `cloudflare-bot/src/services/db.ts`
- [x] 2.3 Add `getExistingRepostDraft(env, chatId, tweetId)` to `cloudflare-bot/src/services/db.ts` — checks drafts table for source='repost' with original_tweet_id matching

## 3. X API: Fetch Single Tweet

- [x] 3.1 Add `getTweetById(env, tweetId)` to `cloudflare-bot/src/services/x.ts` — GET /2/tweets/:id with tweet.fields (text, author_id, conversation_id, in_reply_to_user_id, created_at, referenced_tweets, public_metrics) and expansions (author_id) with user.fields (name, username, description, profile_image_url, public_metrics)
- [x] 3.2 Return both tweet data and expanded author data from the response

## 4. Persona Cache Service

- [x] 4.1 Create `cloudflare-bot/src/services/persona-cache.ts` — `getOrCreatePersona(env, username, userId?, profileBio?)` function that: checks persona_cache → if fresh (<30 days) return cached → otherwise fetch profile via X API + call Gemini with web search grounding → upsert cache → return persona
- [x] 4.2 Reuse existing `cloudflare-bot/src/services/persona-prompt.ts` Gemini web search grounding for persona generation (same prompt as bootstrap)

## 5. Sarcastic Tone

- [x] 5.1 Add `'sarcastic'` to TONES array in `cloudflare-bot/src/actions/account-config.ts`
- [x] 5.2 Add `'😏 Sarcastic'` to toneLabels map in `cloudflare-bot/src/views/accounts.ts`
- [x] 5.3 Update `cloudflare-bot/src/services/repost-prompt.ts` to include sarcastic tone guidelines in the system prompt: sharp observations with humor, irony and wit, respectful edge, genuine insights wrapped in cleverness, Twitter-style smart commentary
- [x] 5.4 Update `twitter-poller/src/services/repost-prompt.ts` with the same sarcastic tone guidelines

## 6. Repost Command & Input Handler

- [x] 6.1 Create `cloudflare-bot/src/commands/repost.ts` — `/repost` command that sets `awaiting_input: 'repost_url'` and shows prompt view
- [x] 6.2 Create `cloudflare-bot/src/views/repost.ts` — `renderRepostPrompt()` ("Send me a tweet URL"), `renderRepostPreview(tweet, author, metrics, isThread, threadCount, tone, existingDraftId?)`, `renderRepostGenerating(username)`
- [x] 6.3 Create `cloudflare-bot/src/inputs/repost-url.ts` — input handler that: parses tweet URL → extracts tweet ID + username → calls `getTweetById` → checks for duplicate via `getExistingRepostDraft` → checks if account is followed → determines default tone → shows preview with tone selector

## 7. Preview & Tone Actions

- [x] 7.1 Create `cloudflare-bot/src/actions/repost-preview.ts` — handlers for:
  - `rp_tone:TONE:TWEET_ID` — update tone selection, edit preview message with new tone highlighted
  - `rp_gen:TWEET_ID` — trigger generation with selected tone
  - `rp_gen_anyway:TWEET_ID` — generate despite duplicate warning
  - `rp_cancel` — cancel and return home
- [x] 7.2 Store preview state in ChatContext: `repost_preview: { tweet_id, username, tweet_text, thread_text?, author_name, author_bio, is_followed, selected_tone, user_id? }`

## 8. Generation Flow

- [x] 8.1 In the `rp_gen` handler: show "Generating..." → load persona (from account overview OR persona cache via `getOrCreatePersona`) → call `generateRepostContent` with tone override → create draft → show draft detail with image
- [x] 8.2 After successful generation for non-followed accounts: send separate follow prompt message "Want to follow @username?" with [Follow] [No thanks] buttons

## 9. Follow Prompt Actions

- [x] 9.1 Create `cloudflare-bot/src/actions/repost-follow.ts` — handlers for:
  - `rp_follow:USERNAME` — create twitter account (reuse existing `createTwitterAccount`), edit message to confirmation
  - `rp_no_follow:MSG_ID` — edit prompt message to "Got it! You can always follow them later."

## 10. Router Registration

- [x] 10.1 Add `/repost` to commandHandlers in router.ts
- [x] 10.2 Add `repost_url` to inputHandlers in router.ts
- [x] 10.3 Add `rp_tone`, `rp_gen`, `rp_gen_anyway`, `rp_cancel`, `rp_follow`, `rp_no_follow` to callbackHandlers in router.ts
- [x] 10.4 Add `view:repost` to viewChangeAction cases

## 11. Home Dashboard

- [x] 11.1 Add "🔄 RePost" button to home.ts keyboard (same row as Handwrite and Generate)
- [x] 11.2 Update help view with `/repost` command documentation

## 12. Deploy & Test

- [x] 12.1 Deploy content-bot worker
- [ ] 12.2 Verify /repost command shows prompt
- [ ] 12.3 Verify pasting tweet URL shows preview with metrics and tone selector
- [ ] 12.4 Verify tone selection updates preview
- [ ] 12.5 Verify generation creates draft with correct tone and shows detail with image
- [ ] 12.6 Verify duplicate detection warns and offers Generate Anyway
- [ ] 12.7 Verify follow prompt appears for unknown accounts
- [ ] 12.8 Verify sarcastic tone appears in account settings cycle
- [ ] 12.9 Verify persona cache stores and reuses persona data
