# HeyGen API Reference

Reference for HeyGen API integration — Avatar IV with full motion.
Compiled from official docs and verified against live API (Feb 2026).

## Account & Authentication

- API Key found at: https://app.heygen.com/settings?nav=API
- Auth header: `X-Api-Key: <your_key>`
- Base URL: `https://api.heygen.com`
- Upload URL: `https://upload.heygen.com` (separate host for asset uploads)

## API Endpoints Summary

| Action | Method | Endpoint |
|--------|--------|----------|
| Upload Asset | POST | `https://upload.heygen.com/v1/asset` |
| Create Avatar Group | POST | `/v2/photo_avatar/avatar_group/create` |
| Add Looks to Group | POST | `/v2/photo_avatar/avatar_group/add` |
| Train Avatar Group | POST | `/v2/photo_avatar/train` |
| Check Training Status | GET | `/v2/photo_avatar/train/status/<group_id>` |
| Check Generation Status | GET | `/v2/photo_avatar/generation/<generation_id>` |
| Generate Look via Prompt | POST | `/v2/photo_avatar/look/generate` |
| List Avatars & Talking Photos | GET | `/v2/avatars` |
| Get Avatar Details | GET | `/v2/photo_avatar/<id>` |
| List Voices | GET | `/v2/voices` |
| **Create Video (Avatar IV)** | **POST** | **`/v2/video/av4/generate`** |
| Check Video Status | GET | `/v1/video_status.get?video_id=<id>` |

### Endpoints that DO NOT exist (verified 404 or wrong)

| Wrong Path | Correct Path |
|------------|-------------|
| `/v2/photo_avatar/avatar_group/add-looks` | `/v2/photo_avatar/avatar_group/add` |
| `/v2/photo_avatar/avatar_group/add_looks` | `/v2/photo_avatar/avatar_group/add` |
| `/v2/photo_avatar/avatar_group/train` | `/v2/photo_avatar/train` |
| `GET /v2/photo_avatar/avatar_group/<id>` | `GET /v2/photo_avatar/train/status/<id>` |
| `GET /v2/photo_avatar/talking_photo` | `GET /v2/avatars` (returns `talking_photos` array) |

## Photo Avatar Group Workflow

### Step 1: Upload Assets

**IMPORTANT: Uses `upload.heygen.com`, NOT `api.heygen.com`. Raw binary body, NOT multipart.**

```
POST https://upload.heygen.com/v1/asset
Headers:
  X-Api-Key: <key>
  Content-Type: image/jpeg  (or image/png)
Body: <raw binary image data>

Response:
{
  "code": 100,
  "data": {
    "id": "abc123",
    "name": "abc123",
    "file_type": "image",
    "image_key": "image/abc123def/original",
    "url": "https://files2.heygen.ai/image/...",
    "created_ts": 1684922369
  },
  "msg": null
}
```

**Key fields:**
- `image_key` — use this for avatar group creation (NOT `id`)
- `image_key` format: `image/<hash>/original`

### Step 2: Create Avatar Group

```
POST /v2/photo_avatar/avatar_group/create
Body:
{
  "name": "My Avatar",
  "image_key": "image/abc123def/original"
}

Response:
{
  "error": null,
  "data": {
    "id": "0b1b8dab...",
    "group_id": "0b1b8dab...",
    "name": "My Avatar",
    "status": "pending",
    "image_url": "https://files2.heygen.ai/image/..."
  }
}
```

### Step 3: Add More Photos (Optional)

```
POST /v2/photo_avatar/avatar_group/add
Body:
{
  "group_id": "<group_id>",
  "image_keys": ["<image_key_1>", "<image_key_2>"],
  "name": "<group_name>"
}
```

- Maximum 4 `image_keys` per request
- `name` field is required

### Step 4: Train the Avatar Group

```
POST /v2/photo_avatar/train
Body: { "group_id": "<group_id>" }
```

**Check training status:**
```
GET /v2/photo_avatar/train/status/<group_id>
Response: { "data": { "status": "pending" | "processing" | "completed" | "failed" } }
```

### Step 5: List Talking Photos (After Training)

```
GET /v2/avatars
Response:
{
  "data": {
    "avatars": [...],
    "talking_photos": [
      {
        "talking_photo_id": "abc123...",
        "talking_photo_name": "My Avatar",
        "preview_image_url": "https://..."
      }
    ]
  }
}
```

- `talking_photo_id` is used as `image_key` in Avatar IV video generation

### Step 6: Generate New Looks via AI Prompt (Optional)

```
POST /v2/photo_avatar/look/generate
Body:
{
  "group_id": "<group_id>",
  "prompt": "Wearing a blue suit in a modern office",
  "orientation": "square",
  "pose": "half_body",
  "style": "Realistic"
}
Response: { "data": { "generation_id": "c37388c9..." } }
```

Check status: `GET /v2/photo_avatar/generation/<generation_id>`

## Voice Configuration

### Voice Cloning (Dashboard Only)
Voice cloning is NOT available via API. Must be done in HeyGen Studio.
After cloning, you get a `voice_id` to use in API calls.

### Listing Available Voices
```
GET /v2/voices
Response:
{
  "data": {
    "voices": [
      {
        "voice_id": "abc123...",
        "name": "Rachel",
        "language": "English",
        "gender": "Female"
      }
    ]
  }
}
```

### Voice Emotion Options
`"Excited"` | `"Friendly"` | `"Serious"` | `"Soothing"` | `"Broadcaster"`

## Video Creation API — Avatar IV

We use the dedicated Avatar IV endpoint for all video generation. This endpoint supports full body movement, hand gestures, and facial expressions via `custom_motion_prompt` per scene.

### Create Video (Avatar IV)

```
POST /v2/video/av4/generate
Headers:
  Content-Type: application/json
  X-Api-Key: <key>
Body:
{
  "image_key": "<talking_photo_id>",
  "voice_id": "<voice_id>",
  "video_title": "My Video Title",
  "dimension": { "width": 1080, "height": 1920 },
  "caption": true,
  "callback_url": "https://your-webhook-url.com/heygen/callback",
  "scenes": [
    {
      "script": "The spoken text for this scene...",
      "emotion": "Friendly",
      "talking_style": "expressive",
      "custom_motion_prompt": "Avatar gestures enthusiastically while leaning forward",
      "enhance_custom_motion_prompt": true
    },
    {
      "script": "Second scene script text...",
      "emotion": "Excited",
      "talking_style": "expressive",
      "custom_motion_prompt": "Avatar raises both hands excitedly, beaming with enthusiasm",
      "enhance_custom_motion_prompt": true
    }
  ]
}

Response:
{
  "error": null,
  "data": {
    "video_id": "abc123..."
  }
}
```

### Request Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `image_key` | string | Yes | The `talking_photo_id` from avatar setup |
| `voice_id` | string | Yes | Voice to use for speech |
| `video_title` | string | No | Title for the video |
| `dimension` | object | Yes | `{ "width": number, "height": number }` |
| `caption` | boolean | No | Enable auto-captions |
| `callback_url` | string | No | Webhook URL for completion notification |
| `scenes` | array | Yes | Array of scene objects |

### Scene Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `script` | string | Yes | Spoken text for this scene |
| `emotion` | string | No | Voice emotion: Excited, Friendly, Serious, Soothing, Broadcaster |
| `talking_style` | string | No | `"expressive"` (more facial gestures) or `"stable"` (neutral) |
| `custom_motion_prompt` | string | No | Body movement description for this scene |
| `enhance_custom_motion_prompt` | boolean | No | Let HeyGen AI refine the motion prompt (recommended: `true`) |

### Key Differences from Old `/v2/video/generate`

- Uses `image_key` instead of `character.type: "talking_photo"` + `talking_photo_id`
- Voice is set once at top level (`voice_id`), not per-scene
- Scenes contain `script` directly (not nested `voice.input_text`)
- Supports `custom_motion_prompt` per scene for body movement
- Supports `enhance_custom_motion_prompt` for AI-refined motion
- Supports `talking_style: "expressive"` for maximum facial gesture intensity

### Custom Motion Prompt Best Practices

Motion prompts describe the avatar's body movement, hand gestures, and facial expressions during each scene.

**Format**: `[Body part/Subject] + [Action] + [Emotion/intensity]` — 1-2 short clauses.

**Good examples:**
- `"Avatar raises both hands excitedly, beaming with enthusiasm"`
- `"Avatar leans forward thoughtfully, counting points on fingers"`
- `"Avatar shrugs casually with a relaxed smile"`
- `"Avatar nods confidently while making an open palm gesture"`
- `"Avatar tilts head and gestures with right hand while explaining"`

**Tips:**
- Use strong action verbs: gesture, lean, nod, point, wave, smile, raise, tilt
- Describe concrete physical actions, not abstract emotions
- Keep to 1-2 short clauses
- Avoid negative phrasing ("don't move arms") — say what to DO
- `enhance_custom_motion_prompt: true` lets HeyGen refine your prompt for their rendering engine

### Dimensions / Aspect Ratios

- 9:16 (vertical, TikTok/Reels): `{ "width": 1080, "height": 1920 }`
- 16:9 (horizontal, YouTube): `{ "width": 1920, "height": 1080 }`
- 1:1 (square, Instagram): `{ "width": 1080, "height": 1080 }`

## Video Status & Webhooks

### Check Video Status
```
GET /v1/video_status.get?video_id=<video_id>
Response:
{
  "data": {
    "status": "pending" | "processing" | "completed" | "failed",
    "video_url": "<url>",
    "error": "<msg>"
  }
}
```

### Webhook Callback
When using `callback_url` in video creation:
```json
{
  "event_type": "avatar_video.success" | "avatar_video.fail",
  "event_data": {
    "video_id": "<id>",
    "url": "<video_url>",
    "error": "<message>",
    "callback_id": "<your_id>"
  }
}
```

## Asset Upload API

**IMPORTANT: Different host than the main API.**

```
POST https://upload.heygen.com/v1/asset
Headers:
  X-Api-Key: <key>
  Content-Type: image/jpeg | image/png | audio/mpeg | video/mp4 | video/webm
Body: <raw binary data>

Response:
{
  "code": 100,
  "data": {
    "id": "...",
    "image_key": "image/.../original",
    "url": "https://files2.heygen.ai/..."
  }
}
```

- Raw binary body, NOT multipart form-data
- `image_key` is present only for image uploads

## Credit Costs

- Avatar IV: ~1 Premium Credit per 3 seconds of video (~20 Premium Credits per minute)
- Rough estimate: ~150 words per minute of speech
- Photo avatar training: included in plan
- AI look generation: included in plan

## Open Questions

1. Does `image_key` in the av4 endpoint accept a `talking_photo_id` directly, or do we need to resolve it to the original asset key? Need to test with actual API.
2. Does the av4 endpoint support `callback_url` for async completion notifications? If not, we'd need to poll.
