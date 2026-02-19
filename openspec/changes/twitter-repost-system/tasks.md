## 1. Database Schema & Types

- [x] 1.1 Add `twitter_accounts` table to `cloudflare-bot/schema.sql` with all columns (id, chat_id, username, user_id, display_name, is_watching, last_tweet_id, config, thread_buffer, timestamps, UNIQUE constraint)
- [x] 1.2 Add `twitter_account_overviews` table to `cloudflare-bot/schema.sql` (id, account_id UNIQUE, persona, topics, communication_style, notable_context, recent_themes, version, timestamps)
- [x] 1.3 Add `twitter_tweets` table to `cloudflare-bot/schema.sql` (id, account_id, chat_id, conversation_id, thread_position, is_thread, text, author_username, metrics, tweet_url, tweeted_at, relevance_score, relevance_reason, status, draft_id, batch_message_id, created_at) with indexes
- [x] 1.4 Add `original_tweet_id TEXT` and `original_tweet_url TEXT` columns to `drafts` table (migration SQL)
- [x] 1.5 Add `TwitterAccountConfig` interface, `DEFAULT_TWITTER_ACCOUNT_CONFIG`, `TwitterAccountOverview`, and `TwitterTweet` types to `cloudflare-bot/src/types.ts`
- [x] 1.6 Add `'repost'` to Draft source type documentation and update `ContentSource` union type
- [x] 1.7 Add `'add_account'` and `'schedule_time'` to `ChatContext.awaiting_input` union type
- [x] 1.8 Run migration on D1 to add new tables and columns (deployment step)

## 2. Database Service Functions (content-bot)

- [x] 2.1 Add `createTwitterAccount(env, chatId, data)` to `cloudflare-bot/src/services/db.ts`
- [x] 2.2 Add `getTwitterAccounts(env, chatId)` — all accounts for a user
- [x] 2.3 Add `getTwitterAccount(env, accountId, chatId)` — single account with ownership check
- [x] 2.4 Add `updateTwitterAccount(env, accountId, chatId, updates)` — update config, is_watching, last_tweet_id
- [x] 2.5 Add `deleteTwitterAccount(env, accountId, chatId)` — delete account and related data
- [x] 2.6 Add `getWatchingTwitterAccounts(env)` — all watching accounts (no chatId filter, for poller)
- [x] 2.7 Add `getTwitterAccountOverview(env, accountId)` and `upsertTwitterAccountOverview(env, accountId, data)`
- [x] 2.8 Add `getTwitterTweet(env, tweetId)` and `createTwitterTweet(env, data)` and `updateTwitterTweet(env, tweetId, updates)`
- [x] 2.9 Add `getRecentTweetsByAccount(env, accountId, limit)` — for persona context (last 20-50 tweets)
- [x] 2.10 Add `getScoredTweetsByBatchMessage(env, batchMessageId)` — for batch message reconstruction
- [x] 2.11 Add `countDraftsBySource` support for `source='repost'`

## 3. Twitter Poller Worker Setup

- [x] 3.1 Create `twitter-poller/` directory at repo root with `wrangler.toml` (same D1 database_id, same R2 bucket, `crons = ["*/15 * * * *"]`)
- [x] 3.2 Create `twitter-poller/tsconfig.json` matching cloudflare-bot config
- [x] 3.3 Create `twitter-poller/package.json` with wrangler dev dependency
- [x] 3.4 Create `twitter-poller/src/types.ts` with Env interface (DB, IMAGES, all required secrets)
- [x] 3.5 Create `twitter-poller/src/index.ts` with `scheduled()` entry point that calls the polling pipeline

## 4. X API Read Service (twitter-poller)

- [x] 4.1 Create `twitter-poller/src/services/x-read.ts` — copy OAuth helpers (hmacSha1, percentEncode, generateOAuthHeader) from content-bot
- [x] 4.2 Implement `lookupUserByUsername(env, username)` — GET /2/users/by/username/:username with user.fields
- [x] 4.3 Implement `getUserTweets(env, userId, sinceId?, maxResults?)` — GET /2/users/:id/tweets with tweet.fields (conversation_id, referenced_tweets, in_reply_to_user_id, created_at, public_metrics)
- [x] 4.4 Implement `searchConversation(env, conversationId, username)` — GET /2/tweets/search/recent for full thread fetch

## 5. Polling Pipeline (twitter-poller)

- [x] 5.1 Create `twitter-poller/src/services/poller.ts` — main `pollTwitterAccounts(env)` function
- [x] 5.2 Implement chunked account selection — consistent hash-based, 10 per cycle
- [x] 5.3 Implement per-account polling: call getUserTweets with since_id, store tweets in twitter_tweets table
- [x] 5.4 Implement thread detection — classify each tweet as standalone or thread continuation using referenced_tweets + in_reply_to_user_id
- [x] 5.5 Implement thread buffering — store buffered tweets, track stale_polls in account.thread_buffer JSON
- [x] 5.6 Implement thread completion check — at stale_polls >= 2, fetch full thread via searchConversation, update tweets to status='pending'
- [x] 5.7 Implement last_tweet_id update after each account poll (max tweet ID from response)

## 6. AI Scoring System (twitter-poller)

- [x] 6.1 Create `twitter-poller/src/services/scoring-prompt.ts` — dedicated system prompt for batch tweet relevance scoring
- [x] 6.2 Create `twitter-poller/src/services/scoring.ts` — `scoreTweetBatch(env, tweets[])` function that sends all pending tweets to Gemini in one call
- [x] 6.3 Implement threshold filtering — update tweets to 'scored' or 'skipped' based on per-account relevanceThreshold
- [x] 6.4 Store relevance_score and relevance_reason on each twitter_tweets row

## 7. AI Content Generation for Reposts (content-bot)

- [x] 7.1 Create `cloudflare-bot/src/services/repost-prompt.ts` — dedicated system prompt for quote-tweet generation with persona and history context
- [x] 7.2 Create `cloudflare-bot/src/services/repost-generate.ts` — `generateRepostContent(env, tweet, accountId)` function
- [x] 7.3 Implement persona context loading — fetch overview + last 20-50 tweets for the account
- [x] 7.4 Implement draft creation for reposts — source='repost', pr_title='@user | preview', commit_sha=tweet_id, original_tweet_id/url
- [x] 7.5 Create `twitter-poller/src/services/repost-prompt.ts` and `twitter-poller/src/services/repost-generate.ts` — copies for auto-approve generation within the poller worker

## 8. Persona Bootstrap (content-bot)

- [x] 8.1 Create `cloudflare-bot/src/services/persona-prompt.ts` — Gemini prompt with web search grounding for persona generation
- [x] 8.2 Create `cloudflare-bot/src/services/persona-bootstrap.ts` — `bootstrapPersona(env, accountId)` function: fetch X profile, recent tweets, call Gemini, store overview

## 9. Auto-Approve Flow (twitter-poller)

- [x] 9.1 After scoring, identify auto-approve accounts with tweets above threshold
- [x] 9.2 For each auto-approve tweet: generate repost content (using poller's copy of generation prompt), create draft with status='approved'
- [x] 9.3 Update twitter_tweets status to 'drafted' with draft_id reference

## 10. Batch Notifications (twitter-poller)

- [x] 10.1 Create `twitter-poller/src/services/telegram.ts` — sendMessage and editMessage functions (copy from content-bot, minimal)
- [x] 10.2 Create `twitter-poller/src/services/batch-notification.ts` — `sendBatchNotification(env, scoredTweets[], autoApprovedDrafts[])` function
- [x] 10.3 Implement batch message format — HTML with @username, score, preview, inline buttons ([Generate] [Open Tweet])
- [x] 10.4 Store batch_message_id on all twitter_tweets rows in the batch

## 11. Generate Action Handler (content-bot)

- [x] 11.1 Create `cloudflare-bot/src/actions/tweet-generate.ts` — handler for `action:tw_gen:TWEET_ID`
- [x] 11.2 Implement: look up tweet → fetch persona + history → generate content → create draft → update tweet status → edit batch Telegram message in-place
- [x] 11.3 Implement batch message reconstruction — fetch all tweets with same batch_message_id, rebuild keyboard with updated buttons

## 12. Accounts Section Views (content-bot)

- [x] 12.1 Create `cloudflare-bot/src/views/accounts.ts` — renderAccountsList, renderAccountDetail, renderAddAccount, renderDeleteAccountConfirm
- [x] 12.2 Export account views from `cloudflare-bot/src/views/index.ts` barrel
- [x] 12.3 Update `cloudflare-bot/src/views/home.ts` — add "👤 Accounts" button to home menu (same row as Repos)
- [x] 12.4 Update `cloudflare-bot/src/views/drafts.ts` — add "🔄 RePosts (N)" category, support listType='repost' with short code 'r', repost-specific title format in list, repost header in detail

## 13. Account Actions & Config (content-bot)

- [x] 13.1 Create `cloudflare-bot/src/actions/account-actions.ts` — accountDetailAction, addAccountAction, deleteAccountAction, confirmDeleteAction, followAction, unfollowAction, bootstrapAction
- [x] 13.2 Create `cloudflare-bot/src/actions/account-config.ts` — toggle handler for tw_config:SETTING:ACCOUNT_ID (language, hashtags, img, img_pct, threshold, tone, auto_approve)
- [x] 13.3 Create `cloudflare-bot/src/inputs/add-twitter-account.ts` — input handler for @username validation and account creation (calls lookupUserByUsername via X API)

## 14. Router Registration (content-bot)

- [x] 14.1 Add `account` callback handler to callbackHandlers in router.ts
- [x] 14.2 Add `tw_gen`, `tw_follow`, `tw_unfollow`, `tw_delete`, `tw_delete_yes`, `tw_bootstrap` to actionSubHandlers
- [x] 14.3 Add `tw_config` callback handler for account config toggles
- [x] 14.4 Add `add_account` and `schedule_time` to inputHandlers
- [x] 14.5 Add `view:accounts`, `view:account_add`, `view:drafts_repost` to viewChangeAction cases
- [x] 14.6 Add `page:accounts` support to paginationAction

## 15. Quote Tweet Publishing (content-bot)

- [x] 15.1 Add `quoteTweetId?: string` to `postTweet()` options in `cloudflare-bot/src/services/x.ts`
- [x] 15.2 Update `publishDraft()` in `cloudflare-bot/src/core/publish.ts` to detect `source='repost'` and publish as quote tweet instead of thread

## 16. Schedule Day Picker (content-bot)

- [x] 16.1 Create `renderScheduleDayPicker(env, chatId, draftId)` view in drafts.ts — show 7 day buttons in user timezone
- [x] 16.2 Create `sched_day` action handler — store selected date in context, prompt for HH:MM
- [x] 16.3 Create `schedule_time` input handler — parse HH:MM, combine with date, convert to UTC, schedule draft
- [x] 16.4 Update existing schedule action to use day picker flow instead of free-text datetime

## 17. X API User Lookup (content-bot)

- [x] 17.1 Add `lookupUserByUsername(env, username)` to `cloudflare-bot/src/services/x.ts` — needed for the add-account input handler to validate usernames

## 18. Integration & Testing

- [x] 18.1 Deploy twitter-poller worker with `wrangler deploy` and verify cron triggers
- [ ] 18.2 Add test account, verify polling fetches tweets and stores in DB
- [ ] 18.3 Verify thread detection works across multiple poll cycles
- [ ] 18.4 Verify batch notifications appear in Telegram with correct format
- [ ] 18.5 Verify Generate button creates draft and edits batch message
- [ ] 18.6 Verify repost drafts appear in RePosts subsection with correct actions
- [ ] 18.7 Verify quote tweet publishing posts correctly on X
- [ ] 18.8 Verify persona bootstrap generates and stores overview
- [ ] 18.9 Verify day picker scheduling flow for all draft types
- [ ] 18.10 Verify auto-approve flow creates approved drafts and shows in batch notification
