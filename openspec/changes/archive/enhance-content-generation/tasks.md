# Tasks

## Phase 1: R2 Storage Setup

- [x] Create R2 bucket: `npx wrangler r2 bucket create content-bot-images`
- [x] Add R2 binding to `wrangler.toml`
- [x] Create `services/r2.ts` with `uploadImage()`, `deleteImage()`, `getImageUrl()`
- [x] Update `Env` type with `IMAGES: R2Bucket`
- [x] Add `/image/*` endpoint to serve R2 images

## Phase 2: Extended Repo Config

- [x] Update `RepoConfig` interface with new fields (codeContext, language, image settings)
- [x] Update `DEFAULT_REPO_CONFIG` with defaults
- [x] Update `renderRepoConfig` view with new toggles
- [x] Update `handleConfigToggle` for new options
- [x] Added `CodeContextLevel` type

## Phase 3: Image Generation at Draft Time

- [x] Update Grok system prompt to include `imagePrompt` in output
- [x] Update `DraftContent` type to include `imagePrompt`
- [x] Modify `generateImage()` to use `content.imagePrompt` if available
- [x] Create `generateAndStoreImage()` for R2 upload flow

## Phase 4: Telegram Image Preview

- [x] Add `sendPhoto()` function to Telegram service
- [x] Add `sendMessageWithImage()` helper for conditional photo/text

## Phase 5: Draft Editing

- [x] Add `edit_draft` to `ChatContext.awaiting_input` type
- [x] Update Edit button to set `awaiting_input: 'edit_draft'`
- [x] Add `edit_draft` case to `handleAwaitingInput`
- [x] Create `handleEditDraftInput()` function
- [x] Create `editContent()` in grok.ts - sends original + instruction

## Phase 6: Enhanced Code Context

- [x] Add `fetchCommitDiff()` to github.ts - get patch data
- [x] Add `fetchFileList()` to github.ts - get file names
- [x] Add `getEnhancedCodeContext()` - context based on config level
- [x] Add `fetchFileContent()` for with_content level

## Phase 7: Publish from R2

- [x] Update `publish` case to check for R2 image first
- [x] Fallback to generating if no pre-stored image
