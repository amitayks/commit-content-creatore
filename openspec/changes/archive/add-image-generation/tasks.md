# Tasks: AI Image Generation

## Implementation ✅

- [x] 1. Create `src/services/image.service.ts`
  - Implemented `generateImage(prompt: string): Promise<Buffer>`
  - Call Grok `grok-2-image` API with b64_json response
  - Added retry logic for reliability

- [x] 2. Add media upload to `src/services/x.service.ts`
  - Implemented `uploadMedia(imageBuffer: Buffer): Promise<string>`
  - Handle X OAuth authentication for media endpoint
  - Return `media_id_string`

- [x] 3. Create image prompt builder
  - Added `buildImagePrompt(projectId, tweetText, style?)` 
  - Extracts context and generates tech-focused prompt

- [x] 4. Integrate into publish workflow
  - Updated `publish-drafts.ts` to generate + upload image
  - Attach `media_ids` to first tweet only
  - Added `publishDraftWithMedia()` method

- [x] 5. Update configuration
  - Set `alwaysGenerateImage: true` in project config

## Verification

- [ ] 6. Test Grok API directly with curl
- [ ] 7. Test X media upload with sample image
- [ ] 8. End-to-end test: generate → publish → verify on X
