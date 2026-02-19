## Context

The HeyGen Avatar IV endpoint (`/v2/video/av4/generate`) requires `image_key` — the asset identifier returned by HeyGen's Upload Asset API. Our character/look system currently only persists `talking_photo_id` (assigned after avatar training). The `image_key` values exist transiently in `cc.assetIds[]` during character creation but are discarded once the group is created.

The video feature is in test mode, so we can break existing character data without migration concerns.

### Current data flow
```
uploadAsset() → image_key (discarded after group creation)
trainGroup() → sync → talking_photo_id (stored on HeyGenLook)
selectLook() → config.talkingPhotoId → createVideo() ✗ av4 needs image_key
```

### Target data flow
```
uploadAsset() → image_key (stored on HeyGenLook.imageKey)
trainGroup() → sync → talking_photo_id (merged onto existing look)
selectLook() → config.imageKey → createVideo() ✓ av4 gets image_key
```

## Goals / Non-Goals

**Goals:**
- Every look stores its `imageKey` from the upload step
- Character creation persists uploaded image_keys as initial looks
- "Add Look" flow uses photo upload (so imageKey is always available)
- Sync merges HeyGen data into existing looks (preserving imageKey)
- Video generation validates imageKey presence before calling av4

**Non-Goals:**
- AI prompt-based look generation (removing — no image_key available)
- Migrating existing characters (test mode — users recreate)
- Storing image_key on the character level (it belongs on each look)

## Decisions

### 1. imageKey stored per-look, not per-character
Each look has its own uploaded image, so `imageKey` belongs on `HeyGenLook`. The character-level `defaultTalkingPhotoId` is no longer needed; look selection drives everything.

### 2. Replace AI look generation with photo upload
AI-generated looks via `/v2/photo_avatar/look/generate` don't expose an `image_key` — HeyGen generates the image internally and only returns a `talking_photo_id`. Since av4 needs `image_key`, we remove AI generation and only support direct photo upload for looks.

### 3. Merge-based sync instead of replace
Current sync (`sync_looks`) replaces `char.looks` entirely. This would wipe stored `imageKey` values. New approach: merge by matching `talking_photo_id`, preserving `imageKey` on matched looks.

### 4. Character creation stores looks immediately
During creation, `cc.assetIds[]` contains the uploaded image_keys. After group creation, store these as initial looks with `imageKey` set and `talkingPhotoId: ''`. On first sync after training, `talkingPhotoId` gets filled in.

### 5. Look upload flow reuses character-create photo handling
The "Add Look" photo upload uses the same pattern as character creation: receive photo → `uploadAsset()` → `addLooksToGroup()` → store look with imageKey. The `LookCreateState` changes from `awaiting_name` (prompt) to `awaiting_photo` (image).

## Risks / Trade-offs

- **[Breaking change]** Existing characters have no `imageKey` on looks → Users must recreate characters. Acceptable since video feature is in test mode.
- **[No AI looks]** Removing prompt-based look generation reduces flexibility → Trade-off accepted; av4 compatibility is the priority. Can revisit if HeyGen exposes `image_key` for generated looks in the future.
- **[Sync ordering]** Merge-based sync relies on matching `talking_photo_id` → Looks uploaded but not yet synced will have `talkingPhotoId: ''` and won't match. This is fine; they keep their `imageKey` and get matched on subsequent syncs once training completes.
