## 1. Type System

- [x] 1.1 Add `imageKey: string` to `HeyGenLook` interface in `src/types.ts`
- [x] 1.2 Add `imageKey` to `VideoConfig` interface in `src/types.ts` (already done — verify)
- [x] 1.3 Change `LookCreateState` step from `'awaiting_name'` to `'awaiting_photo'` in `src/types.ts`

## 2. Character Creation — Store image_keys as looks

- [x] 2.1 In `src/inputs/character-create.ts`, after group creation + training, create initial looks from `cc.assetIds[]` with `imageKey: assetId, talkingPhotoId: '', name: 'Photo N'`
- [x] 2.2 Store these looks on the new character object before saving to video settings

## 3. Add Look — Photo Upload Flow

- [x] 3.1 In `src/actions/video-settings.ts` `add_look` case, change compose state to `step: 'awaiting_photo'` instead of `'awaiting_name'`
- [x] 3.2 Update the `add_look` UI text to instruct user to send a photo (not a text prompt)
- [x] 3.3 Rewrite `src/inputs/look-create.ts` to handle photo upload: receive photo → `uploadAsset()` → `addLooksToGroup()` → store look with `imageKey` on character
- [x] 3.4 Handle text input in look-create: show message asking for a photo instead

## 4. Sync Looks — Merge-based

- [x] 4.1 In `src/actions/video-settings.ts` `sync_looks` case, replace the full-replace logic with merge logic: match synced `talking_photo_id` or name to existing looks, update `talkingPhotoId` while preserving `imageKey`
- [x] 4.2 Add new synced looks that don't match as looks with `imageKey: ''`
- [x] 4.3 Preserve existing looks that weren't found in sync results (keep their `imageKey`)

## 5. Look Selection & Video Config

- [x] 5.1 In `src/actions/video-actions.ts` look selection (around line 186), set `config.imageKey = look.imageKey` alongside existing `config.talkingPhotoId`
- [x] 5.2 In preset loading, include `imageKey` in known fields to pick from parsed JSON

## 6. Validation & Error Handling

- [x] 6.1 In `src/actions/video-actions.ts` `videoApproveAction`, check `config.imageKey` is non-empty before calling `createVideo()`
- [x] 6.2 Show error message: "This look doesn't have an image key. Please re-upload the photo for this look." if imageKey is missing

## 7. UI Updates

- [x] 7.1 In `src/views/video-settings.ts` `renderCharacterDetail`, show imageKey status indicator on each look (e.g. checkmark if present, warning if missing)
- [x] 7.2 Remove AI generation references from look-related UI text

## 8. Cleanup

- [x] 8.1 Remove `generateLook` and `checkGenerationStatus` exports from `src/services/heygen.ts` (no longer used)
- [x] 8.2 Remove generation-related types (`GenerateLookResponse`, `GenerationStatusResponse`) from `src/services/heygen.ts`
- [x] 8.3 Run `npx tsc --noEmit` and fix any type errors
- [x] 8.4 Deploy with `npx wrangler deploy` and verify no runtime errors
