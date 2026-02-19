## Context

The bot generates AI avatar videos via HeyGen's API. Currently it uses `POST /v2/video/generate` with `character.type: 'talking_photo'` — the Avatar III (Unlimited) engine. Despite the UI offering an "Avatar IV" engine toggle, the `use_avatar_iv_model` flag is never sent, so all videos render with basic lip-sync only.

HeyGen offers a dedicated Avatar IV endpoint (`POST /v2/video/av4/generate`) that takes an `image_key`, `voice_id`, scene-level scripts, and critically: `custom_motion_prompt` per scene for body movement, hand gestures, and facial expressions. This endpoint also supports `enhance_custom_motion_prompt` to let HeyGen's AI refine motion descriptions.

The Gemini script generator currently produces `scriptText`, `emotion`, `avatarStyle`, and `textOverlay` per scene. It needs to also generate a `motionPrompt` per scene — a short description of how the avatar should move/react during that segment.

## Goals / Non-Goals

**Goals:**
- Switch all video generation to HeyGen's Avatar IV endpoint (`/v2/video/av4/generate`) with full motion capabilities
- Generate per-scene `custom_motion_prompt` values via Gemini that follow HeyGen's best practices
- Remove the engine toggle — Avatar IV is the only engine, hardcoded
- Simplify `VideoConfig` and `VideoScene` types by removing dead fields (`engine`, `avatarStyle`, `HeyGenEngine`, `HeyGenAvatarStyle`)
- Set `talking_style: "expressive"` to maximize facial gesture intensity
- Update credit estimation to reflect Avatar IV pricing only

**Non-Goals:**
- Add Motion post-processing (Runway/Kling/Hailuo engines) — separate future work
- Gesture Control (per-word gesture assignment) — Enterprise only, not in API
- Interactive/Streaming avatars — different product
- Backward compatibility with v3 — we're removing it entirely

## Decisions

### 1. Use `/v2/video/av4/generate` instead of `/v2/video/generate`

**Why**: The av4 endpoint natively supports `custom_motion_prompt` and `enhance_custom_motion_prompt` per scene. The older endpoint only supports `use_avatar_iv_model: true` as a boolean toggle with no per-scene motion control.

**Alternative considered**: Adding `use_avatar_iv_model: true` to the existing `/v2/video/generate` endpoint. This would be simpler but would not unlock custom motion prompts — the key feature we want.

**Request body structure for av4 endpoint:**
```json
POST /v2/video/av4/generate
{
  "image_key": "<talking_photo_id>",
  "voice_id": "<voice_id>",
  "video_title": "<title>",
  "dimension": { "width": 1080, "height": 1920 },
  "caption": true,
  "callback_url": "https://...",
  "scenes": [
    {
      "script": "The spoken text for this scene...",
      "emotion": "Friendly",
      "custom_motion_prompt": "Avatar gestures enthusiastically while leaning forward",
      "enhance_custom_motion_prompt": true
    }
  ]
}
```

### 2. Generate motion prompts in Gemini alongside script text

**Why**: Motion prompts need to match the content and emotion of each scene. Having Gemini generate them ensures consistency — it knows what the avatar is talking about and can describe matching body language.

**Motion prompt format**: Follow HeyGen's best practice formula: `[Body part] + [Action] + [Emotion/intensity]`. Keep to 1-2 short clauses. Use strong verbs (gesture, lean, nod, point, wave, smile).

**Examples per tone:**
- Excited Launch: "Avatar raises both hands excitedly, beaming with enthusiasm"
- Technical Deep Dive: "Avatar leans forward thoughtfully, counting points on fingers"
- Casual Update: "Avatar shrugs casually with a relaxed smile"
- Professional: "Avatar nods confidently while making an open palm gesture"

### 3. Hardcode Avatar IV — remove engine toggle entirely

**Why**: User explicitly wants only the best quality. The engine toggle was confusing because it appeared to do something but never did. Removing it simplifies the config UI and codebase.

**What gets removed:**
- `engine` field from `VideoConfig` and `DEFAULT_VIDEO_CONFIG`
- `HeyGenEngine` type
- `avatarStyle` field from `VideoConfig`, `VideoScene`, and `DEFAULT_VIDEO_CONFIG`
- `HeyGenAvatarStyle` type
- Engine toggle button in `renderVideoConfig`
- Engine cycling case in `videoConfigAction`
- Engine display line in config view

### 4. Always set `enhance_custom_motion_prompt: true`

**Why**: HeyGen's AI refinement improves motion naturalness. No reason not to use it. We generate a base prompt from Gemini and let HeyGen polish it for their rendering engine.

### 5. Map emotion to expression parameter

**Why**: The av4 endpoint may support an `expression` field alongside `emotion`. Map scene emotion to expression: Excited/Friendly → "happy", Serious/Soothing/Broadcaster → "default".

## Risks / Trade-offs

- **[Cost increase]** → Avatar IV costs ~6 credits/min vs 1 for Unlimited. Mitigation: User explicitly requested this. Update credit estimation to always show IV rates. The quality improvement is worth it.

- **[Breaking existing presets]** → Saved presets contain `engine` and `avatarStyle` fields. Mitigation: Ignore unknown fields during preset loading (`JSON.parse` + pick known fields). Old presets will work but lose the engine field.

- **[av4 endpoint differences]** → The av4 endpoint may have slightly different request/response shapes than what we expect. Mitigation: Add clear error logging on failures, test with actual API calls.

- **[Motion prompt quality]** → Gemini-generated motion prompts may not always produce good motion. Mitigation: `enhance_custom_motion_prompt: true` lets HeyGen refine them. Users can also provide manual instructions to guide script generation.

- **[Image key vs talking_photo_id]** → The av4 endpoint uses `image_key` while we store `talking_photo_id`. These may or may not be interchangeable. Mitigation: Try `talking_photo_id` as `image_key`. If that fails, we may need to look up the image_key from the photo avatar group details.

## Open Questions

1. Does `image_key` in the av4 endpoint accept a `talking_photo_id` directly, or do we need to resolve it to the original asset key? Need to test with actual API.
2. Does the av4 endpoint support `callback_url` for async completion notifications? If not, we'd need to poll.
