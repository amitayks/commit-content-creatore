## ADDED Requirements

### Requirement: Avatar IV is the only video generation engine
The system SHALL use HeyGen's Avatar IV endpoint (`/v2/video/av4/generate`) for all video generation. No other engine option SHALL exist.

#### Scenario: Video generation uses av4 endpoint
- **WHEN** a video generation is triggered (approve & generate)
- **THEN** the system sends a POST request to `/v2/video/av4/generate` with the scene scripts, voice_id, image_key, and motion prompts

#### Scenario: No engine selection in configuration
- **WHEN** a user opens the video configuration screen
- **THEN** there SHALL be no engine toggle or engine display — Avatar IV is implied and hardcoded

### Requirement: Per-scene custom motion prompts
Each scene in the video request SHALL include a `custom_motion_prompt` field describing the avatar's body movement, hand gestures, and facial expressions for that scene. The `enhance_custom_motion_prompt` field SHALL always be set to `true`.

#### Scenario: Motion prompt sent per scene
- **WHEN** the system sends a video generation request to HeyGen
- **THEN** each scene object SHALL contain `custom_motion_prompt` (string) and `enhance_custom_motion_prompt: true`

#### Scenario: Motion prompt describes physical movement
- **WHEN** a motion prompt is generated for a scene
- **THEN** it SHALL follow the format "[Body part/Subject] + [Action] + [Emotion/intensity]" in 1-2 short clauses using strong verbs

### Requirement: Gemini generates motion prompts alongside scripts
The Gemini video script generation system prompt SHALL instruct the AI to produce a `motionPrompt` field per scene, describing how the avatar should move and react during that segment.

#### Scenario: Script response includes motion prompts
- **WHEN** Gemini generates a video script
- **THEN** each scene in the JSON response SHALL include a `motionPrompt` field with a HeyGen-compatible motion description

#### Scenario: Motion prompts match scene content and emotion
- **WHEN** a scene has emotion "Excited" and discusses a new feature launch
- **THEN** the motion prompt SHALL describe energetic, enthusiastic body language (e.g., "Avatar raises hands excitedly, beaming with enthusiasm")

#### Scenario: Motion prompts follow HeyGen best practices
- **WHEN** a motion prompt is generated
- **THEN** it SHALL be 1-2 short clauses, use strong action verbs, describe concrete physical actions (not abstract emotions), and avoid negative phrasing

### Requirement: Expressive talking style
All video generation requests SHALL set `talking_style` to `"expressive"` for maximum facial gesture intensity and emotional nuance.

#### Scenario: Talking style always expressive
- **WHEN** a video generation request is sent to HeyGen
- **THEN** the request SHALL include talking_style set to "expressive" (not "stable")

### Requirement: VideoConfig simplified without engine fields
The `VideoConfig` type SHALL NOT contain `engine`, `avatarStyle`, or any engine-selection fields. The `VideoScene` type SHALL NOT contain `avatarStyle`. Both SHALL contain a `motionPrompt` field instead.

#### Scenario: VideoConfig has no engine field
- **WHEN** a VideoConfig object is created or loaded
- **THEN** it SHALL NOT have `engine` or `avatarStyle` properties
- **THEN** it SHALL NOT have `HeyGenEngine` or `HeyGenAvatarStyle` type references

#### Scenario: VideoScene includes motionPrompt
- **WHEN** a VideoScene object is created from Gemini output
- **THEN** it SHALL have a `motionPrompt` string field containing the motion description for that scene

### Requirement: Credit estimation uses Avatar IV rates only
Credit estimation SHALL always use Avatar IV rates (approximately 1 Premium Credit per 3 seconds of video). The system SHALL NOT display or calculate Avatar III rates.

#### Scenario: Credit cost displayed
- **WHEN** the system displays estimated credit cost for a video
- **THEN** it SHALL calculate using Avatar IV premium credit rates only, with no mention of alternative engines or rates

### Requirement: Config UI removes engine-related controls
The video configuration view SHALL NOT display engine toggle, engine label, or avatar style selector. The removed space SHALL be reclaimed (no empty gaps).

#### Scenario: Config screen layout
- **WHEN** a user views the video configuration screen
- **THEN** the following controls SHALL NOT be present: engine toggle button, avatar style selector, engine display label
- **THEN** all remaining controls SHALL render without gaps

### Requirement: Backward compatibility for saved presets and drafts
Existing saved presets and video drafts that contain `engine` and `avatarStyle` fields SHALL still load successfully. Unknown fields SHALL be silently ignored.

#### Scenario: Loading old preset with engine field
- **WHEN** a preset saved with `engine: "v3"` is loaded
- **THEN** the system SHALL ignore the `engine` field and load all other config values normally

#### Scenario: Viewing old draft with v3 config
- **WHEN** a completed video draft created with v3 engine config is viewed
- **THEN** the detail view SHALL display correctly without errors
