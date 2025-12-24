# OpenSpec Proposal: AI Image Generation for X Posts

## Status
🔵 **PROPOSED** | Priority: Medium | Estimated: 1 day

## Problem Statement

Published X threads lack visual appeal. The system has placeholder support for images but no actual implementation. Users want AI-generated images attached to posts to increase engagement.

## Proposed Solution

Implement AI image generation using **Grok grok-2-image-1212** model and attach one image per post (first tweet only for threads).

### API Details

**Grok Image API:**
- Endpoint: `https://api.x.ai/v1/images/generations`
- Model: `grok-2-image`
- Returns: URL or base64 encoded image
- Note: Images include a visible "GROK" watermark

**X Media Upload:**
- Endpoint: `https://upload.twitter.com/1.1/media/upload.json`
- Returns: `media_id_string` to attach to tweets

### Flow

```
Content Generation
        │
        ▼
Generate Tweet Text (Grok)
        │
        ▼
Generate Image Prompt (from content context)
        │
        ▼
Generate Image (Grok Image API)
        │
        ▼
Download Image → Upload to X (media/upload)
        │
        ▼
Post Tweet with media_id
```

---

## Technical Design

### 1. Image Generation Service

```typescript
// src/services/image.service.ts

export async function generateImage(prompt: string): Promise<Buffer> {
  const response = await fetch('https://api.x.ai/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEYS.GROK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'grok-2-image',
      prompt: prompt,
      n: 1,
      response_format: 'b64_json', // Get base64 for direct upload
    }),
  });
  
  const data = await response.json();
  return Buffer.from(data.data[0].b64_json, 'base64');
}
```

### 2. X Media Upload

```typescript
// src/services/x.service.ts (additions)

export async function uploadMedia(imageBuffer: Buffer): Promise<string> {
  // X requires form-data upload for media
  const base64 = imageBuffer.toString('base64');
  
  const response = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
    method: 'POST',
    headers: {
      'Authorization': oauth.toHeader(oauth.authorize(requestData, token)),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      media_data: base64,
    }),
  });
  
  const data = await response.json();
  return data.media_id_string;
}
```

### 3. Integration in Publishing

```typescript
// In publish flow
if (config.thread.alwaysGenerateImage) {
  const imagePrompt = buildImagePrompt(draft);
  const imageBuffer = await generateImage(imagePrompt);
  const mediaId = await uploadMedia(imageBuffer);
  
  // Attach to first tweet only
  tweets[0].mediaIds = [mediaId];
}
```

### 4. Image Prompt Generation

Generate a suitable prompt based on the content:

```typescript
function buildImagePrompt(draft: Draft): string {
  const content = draft.content.tweets[0].text;
  const projectId = draft.projectId;
  
  return `Create a modern, clean tech illustration for a developer announcement. 
          Theme: ${projectId}. 
          Context: ${content.slice(0, 100)}. 
          Style: Professional, minimal, dark mode aesthetic, 
          suitable for Twitter/X tech audience.`;
}
```

---

## Configuration

Update project config schema:

```yaml
images:
  enabled: true
  generateFor: first_tweet  # first_tweet | all_tweets | none
  style: "modern tech aesthetic, dark theme, minimal"
```

---

## Implementation Tasks

1. [ ] Create `image.service.ts` with Grok image generation
2. [ ] Add `uploadMedia()` to `x.service.ts`
3. [ ] Create image prompt builder function
4. [ ] Integrate into publish workflow
5. [ ] Update config schema for image settings
6. [ ] Test end-to-end flow

---

## Verification Plan

### Manual Testing
1. Run content generation with image enabled
2. Approve draft via Telegram
3. Run `/publish` command
4. Verify tweet appears with attached image
5. Check image has GROK watermark (expected)

### API Testing
```bash
# Test Grok image generation directly
curl -X POST https://api.x.ai/v1/images/generations \
  -H "Authorization: Bearer $GROK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"grok-2-image","prompt":"test","n":1}'
```

---

## Limitations & Notes

1. **Grok Watermark**: All images have visible "GROK" watermark
2. **No Size Control**: Grok API doesn't support custom sizes
3. **Rate Limits**: Subject to Grok API rate limits
4. **Cost**: Included in Grok API pricing (same key as text)

---

## Questions

1. Is the GROK watermark acceptable for published posts?
2. Should we store generated images locally before upload?
