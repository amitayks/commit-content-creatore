## Why

The HeyGen Avatar IV endpoint (`/v2/video/av4/generate`) requires an `image_key` (returned by the Upload Asset API) to identify the avatar image. Currently, the character/look system only stores `talking_photo_id` (a different identifier assigned after training). The `image_key` values are used transiently during character creation and then discarded, making av4 video generation impossible. This refactor stores `image_key` on each look so it flows through to video creation.

## What Changes

- **Add `imageKey` field to `HeyGenLook`** — each look stores the `image_key` from asset upload alongside its `talking_photo_id`
- **Store image_keys during character creation** — the uploaded photo asset IDs (which are image_keys) are persisted as initial looks on the character
- **Replace AI look generation with photo upload** — the "Add Look" flow switches from AI prompt generation to direct photo upload, ensuring every look has an `image_key`. **BREAKING**: removes AI look generation via prompt
- **Merge-based sync** — `sync_looks` preserves existing `imageKey` values when merging with HeyGen's talking photo data, instead of replacing all looks
- **Wire `imageKey` through video config** — when a look is selected, its `imageKey` populates `VideoConfig.imageKey` for the av4 endpoint
- **Validate `imageKey` before generation** — block video generation if the selected look has no `imageKey`, with a helpful re-upload message

## Capabilities

### New Capabilities
- `look-image-key`: Store and manage `imageKey` on looks, upload-based look creation, merge-based sync, imageKey validation and flow through to video generation

### Modified Capabilities

## Impact

- `src/types.ts` — `HeyGenLook` interface, `LookCreateState`, `VideoConfig`
- `src/inputs/character-create.ts` — store image_keys as initial looks
- `src/inputs/look-create.ts` — convert from AI prompt to photo upload
- `src/actions/video-settings.ts` — add_look flow, sync_looks merge logic
- `src/actions/video-actions.ts` — look selection sets imageKey, validation
- `src/views/video-settings.ts` — optional: show imageKey status on looks
- `src/services/heygen.ts` — already updated to read `config.imageKey`
