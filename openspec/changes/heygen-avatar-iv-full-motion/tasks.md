## 1. Type System Cleanup

- [x] 1.1 Remove `HeyGenEngine` type, `HeyGenAvatarStyle` type, and `engine`/`avatarStyle` fields from `VideoConfig` in `src/types.ts`
- [x] 1.2 Remove `avatarStyle` from `VideoScene` interface and add `motionPrompt: string` field to `VideoScene` in `src/types.ts`
- [x] 1.3 Update `DEFAULT_VIDEO_CONFIG` to remove `engine` and `avatarStyle` defaults in `src/types.ts`
- [x] 1.4 Remove `engine` from `VideoScriptOptions` interface in `src/services/gemini.ts`

## 2. HeyGen API — Switch to Avatar IV Endpoint

- [x] 2.1 Create new `CreateAvatarIVRequest` interface in `src/services/heygen.ts` matching the `/v2/video/av4/generate` request body (image_key, voice_id, video_title, dimension, caption, callback_url, scenes with script/emotion/custom_motion_prompt/enhance_custom_motion_prompt)
- [x] 2.2 Rewrite `createVideo()` function to POST to `/v2/video/av4/generate` with the new request structure, mapping `config.talkingPhotoId` to `image_key`, building scenes array with `custom_motion_prompt` from each scene's `motionPrompt`
- [x] 2.3 Remove old `CreateVideoRequest` interface and any v3/Unlimited-specific code
- [x] 2.4 Update `estimateCreditCost()` to use Avatar IV rates only (1 premium credit per 3 seconds, remove engine parameter)

## 3. Gemini Script Generation — Add Motion Prompts

- [x] 3.1 Update `VIDEO_SCRIPT_SYSTEM_PROMPT` to instruct Gemini to generate a `motionPrompt` per scene following HeyGen's format: "[Subject] + [Action] + [Emotion/intensity]", 1-2 clauses, strong verbs, concrete physical actions
- [x] 3.2 Update the JSON response structure in the system prompt to include `motionPrompt` field per scene (remove `avatarStyle` and `direction` fields)
- [x] 3.3 Update `parseAndValidateVideoScript()` to extract and validate `motionPrompt` from each scene, with a sensible fallback if missing (e.g., "Avatar speaks naturally with subtle gestures")
- [x] 3.4 Remove `engine` parameter from `VideoScriptOptions` and its usage in `generateVideoScript()`

## 4. Video Config UI — Remove Engine Controls

- [x] 4.1 Remove engine toggle button and engine cycling case from `videoConfigAction()` in `src/actions/video-actions.ts`
- [x] 4.2 Remove engine display line and engine label from `renderVideoConfig()` in `src/views/video-studio.ts`
- [x] 4.3 Update credit cost display in `renderScriptPreview()` to show Avatar IV rates without engine distinction
- [x] 4.4 Remove `ENGINE_OPTIONS` array and engine cycling logic from `src/actions/video-actions.ts`

## 5. Callers and Integration

- [x] 5.1 Update all callers of `generateVideoScript()` to stop passing `engine` option (in `videoGenerateAction` and `videoRegenAction` in `src/actions/video-actions.ts`)
- [x] 5.2 Update all callers of `estimateCreditCost()` to stop passing engine parameter
- [x] 5.3 Update all callers of `createVideo()` to pass the `VideoScriptResponse` with motion prompts (in `videoApproveAction` in `src/actions/video-actions.ts` and `advanceQueue` in `src/routes/heygen-webhook.ts`)
- [x] 5.4 Ensure preset loading ignores unknown `engine`/`avatarStyle` fields gracefully (pick only known fields from parsed JSON)

## 6. Type Check and Deploy

- [x] 6.1 Run `npx tsc --noEmit` and fix any type errors from removed fields
- [x] 6.2 Deploy with `npx wrangler deploy` and verify no runtime errors
