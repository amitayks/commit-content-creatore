# Tasks

## Phase 1: Remove Webhook Image Generation
- [x] Remove image generation code from `handlePushEvent` in github-webhook.ts
- [x] Remove image generation code from `handlePullRequestEvent`  
- [x] Keep notification sending as-is (fast, no timeout)

## Phase 2: On-Demand Image Generation
- [x] Add `ensureImage(env, draft)` helper function to check/generate image
- [x] Update `handleCallback` for `draft:` case to call `ensureImage` before rendering
- [x] Store generated image key in draft.image_url via `updateDraft`

## Phase 3: Display Image in Draft View
- [x] Update `renderDraftDetail` to return image URL if available
- [x] Modify callback handler to use `sendPhoto` when draft has image
- [x] Handle edit message vs send new photo for Telegram limitations

## Phase 4: Publish from R2
- [x] Update publish flow to check `draft.image_url` first
- [x] Fetch image from R2 and upload to X via worker URL
- [x] Skip image generation if R2 image exists
