## 1. Schema & Types

- [x] 1.1 Create migration `cloudflare-bot/migrations/003_tweet_media_url.sql` — `ALTER TABLE twitter_tweets ADD COLUMN media_url TEXT DEFAULT NULL`
- [x] 1.2 Run migration on D1
- [x] 1.3 Add `media_url: string | null` to `TwitterTweet` interface in `twitter-poller/src/types.ts`
- [x] 1.4 Add `media_url: string | null` to `TwitterTweet` interface in `cloudflare-bot/src/types.ts`
- [x] 1.5 Add `analyzeMedia: boolean` to `TwitterAccountConfig` in both `cloudflare-bot/src/types.ts` and `twitter-poller/src/types.ts` (default `true`)
- [x] 1.6 Add `analyzeMedia` to `DEFAULT_TWITTER_ACCOUNT_CONFIG` in both types files

## 2. Poller — X API Media Expansions

- [x] 2.1 Add `attachments` to `tweet.fields`, `attachments.media_keys` to `expansions`, and `media.fields=media_key,type,url,preview_image_url` to `getUserTweets` in `twitter-poller/src/services/x-read.ts`
- [x] 2.2 Add media type to `XTweet` interface (add `attachments?: { media_keys?: string[] }`)
- [x] 2.3 Update `getUserTweets` return type to include `media` array from `includes.media` — return `{ tweets, newestId, media }` where media is `Array<{ media_key, type, url?, preview_image_url? }>`
- [x] 2.4 Create helper `getMediaUrl(media, tweet)` — given the media array and a tweet, returns the first photo `url` or first video/gif `preview_image_url`, or null

## 3. Poller — Store Media URL

- [x] 3.1 Add `media_url` field to `createTwitterTweet` function signature and INSERT statement in `twitter-poller/src/services/db.ts`
- [x] 3.2 Update both `createTwitterTweet` call sites in `twitter-poller/src/services/poller.ts` to pass `media_url` using the `getMediaUrl` helper (line ~161 for single tweets, line ~308 for threads)

## 4. Poller — Multimodal Generation

- [x] 4.1 Update `generateRepostContent` in `twitter-poller/src/services/repost-generate.ts` — add optional `imageUrl` param, fetch image + base64 + send as `inline_data` part to Gemini (same pattern as content-bot version)
- [x] 4.2 Update `buildRepostUserPrompt` in `twitter-poller/src/services/repost-prompt.ts` — add `hasImage?: boolean` param, append image note when true
- [x] 4.3 Update `generateAndApproveDraft` in `twitter-poller/src/services/auto-approve.ts` — pass `tweet.media_url` to `generateRepostContent` when `config.analyzeMedia` is true

## 5. Content-Bot — Batch Generate with Media

- [x] 5.1 Update `tweetGenerateAction` in `cloudflare-bot/src/actions/tweet-generate.ts` — pass `tweet.media_url` to `generateRepostContent` when account config has `analyzeMedia: true` (add `undefined` for `personaOverride`, then `config.analyzeMedia ? tweet.media_url : undefined` for `imageUrl`)

## 6. Account Config UI

- [x] 6.1 Add `analyze_media` case to `accountConfigToggleAction` switch in `cloudflare-bot/src/actions/account-config.ts` — toggles `config.analyzeMedia`
- [x] 6.2 Add media analysis display and toggle button to `renderAccountDetail` in `cloudflare-bot/src/views/accounts.ts` — show icon + "Media AI" toggle alongside existing settings

## 7. Deploy & Test

- [x] 7.1 Deploy twitter-poller worker
- [x] 7.2 Deploy content-bot worker
- [ ] 7.3 Verify poller stores media_url for tweets with images
- [ ] 7.4 Verify poller stores video thumbnail as media_url for tweets with videos
- [ ] 7.5 Verify batch Generate sends image to Gemini when analyzeMedia is true
- [ ] 7.6 Verify auto-approve sends image to Gemini when analyzeMedia is true
- [ ] 7.7 Verify manual /repost still works with media (already implemented)
- [ ] 7.8 Verify analyzeMedia toggle works in account settings
- [ ] 7.9 Verify tweets without media generate normally (text-only)
