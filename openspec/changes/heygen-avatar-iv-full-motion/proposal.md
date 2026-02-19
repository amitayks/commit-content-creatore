## Why

The current HeyGen integration sends identical API requests regardless of the user's engine selection. The `use_avatar_iv_model` flag is never set, and the dedicated Avatar IV endpoint (`/v2/video/av4/generate`) with custom motion prompts is unused. As a result, all generated videos use the basic Avatar III (Unlimited) engine — lip-sync only, no body movement, no facial expressions, no hand gestures. Users are paying for Avatar IV credits but getting Avatar III output. We need to switch entirely to Avatar IV with full motion capabilities and remove the lesser engine option.

## What Changes

- **BREAKING**: Remove the `engine` toggle (`v3`/`v4`) from video configuration — Avatar IV is now the only engine, hardcoded.
- Switch from `/v2/video/generate` to the dedicated `/v2/video/av4/generate` endpoint that supports `custom_motion_prompt` per scene.
- Add `custom_motion_prompt` and `enhance_custom_motion_prompt` parameters to each scene for full body movement, gestures, and facial expressions.
- Update Gemini script generation system prompt to produce motion prompts per scene alongside script text — following HeyGen's prompting best practices (subject + action + emotion, 1-2 clauses, strong verbs).
- Set `talking_style: "expressive"` and `expression` mapping based on scene emotion.
- Remove engine-related UI elements (engine toggle button, engine display in config, credit-per-minute distinction).
- Update credit estimation to always use Avatar IV rates.

## Capabilities

### New Capabilities
- `avatar-iv-motion`: Full Avatar IV integration with motion prompts, expressive talking style, and body movement generation via the dedicated av4 API endpoint.

### Modified Capabilities
<!-- No existing specs to modify -->

## Impact

- `src/services/heygen.ts` — New `CreateAvatarIVRequest` interface, new `createVideo` implementation targeting `/v2/video/av4/generate`, remove old v3 request path.
- `src/services/gemini.ts` — Update video script system prompt to generate `motionPrompt` per scene with HeyGen-compatible movement descriptions.
- `src/types.ts` — Remove `engine` and `HeyGenEngine` type, remove `avatarStyle`/`HeyGenAvatarStyle`, add `motionPrompt` to scene type, simplify `VideoConfig`.
- `src/views/video-studio.ts` — Remove engine toggle from config display, update credit estimation.
- `src/actions/video-actions.ts` — Remove engine cycling logic, simplify config actions.
- `src/routes/heygen-webhook.ts` — No changes expected (webhook payload structure unchanged).
