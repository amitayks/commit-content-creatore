## ADDED Requirements

### Requirement: Video script system prompt
The system SHALL use a dedicated Gemini system prompt for video script generation, separate from the tweet generation prompt. The prompt SHALL instruct Gemini to produce a multi-scene talking script structured for HeyGen's per-scene API model.

#### Scenario: Script prompt includes repo context
- **WHEN** script generation is called for a repo with an overview
- **THEN** the system prompt SHALL include the repo overview (summary, tech stack, key features, target audience) as background context

#### Scenario: Script prompt includes commit context
- **WHEN** script generation is called with commit depth > 0
- **THEN** the system prompt SHALL include the specified number of recent commit messages and file names

#### Scenario: Script prompt respects tone setting
- **WHEN** script generation is called with tone "Technical Deep Dive"
- **THEN** the system prompt SHALL instruct Gemini to use technical language, explain implementation details, and assume an audience of developers

#### Scenario: Script prompt respects length setting
- **WHEN** script generation is called with length 60s
- **THEN** the system prompt SHALL instruct Gemini to produce a total script of approximately 150-170 words (average speaking pace of ~150 words/minute)

### Requirement: Multi-scene script output format
The script generation SHALL return a JSON object with per-scene structure that maps directly to HeyGen's multi-scene video generation API.

#### Scenario: Valid script response structure
- **WHEN** Gemini responds to the script generation prompt
- **THEN** the response SHALL be valid JSON with the following structure:
```json
{
  "title": "Short video reference title",
  "scenes": [
    {
      "scriptText": "The spoken text for this scene segment...",
      "emotion": "Friendly",
      "avatarStyle": "normal",
      "textOverlay": "Optional key point text shown on screen",
      "direction": "Lean forward, gesture with hands"
    }
  ],
  "caption": "Social media caption text (max 2200 chars for Instagram)",
  "twitterCaption": "Short caption for Twitter (max 280 chars)",
  "totalWordCount": 160
}
```

#### Scenario: Single scene for short videos
- **WHEN** script is generated for a 30s or 60s video
- **THEN** the output SHALL contain 1-2 scenes
- **AND** total word count SHALL be approximately 60-170 words

#### Scenario: Multiple scenes for longer videos
- **WHEN** script is generated for a 3m or 5m video
- **THEN** the output SHALL contain 3-10 scenes with natural transitions
- **AND** total word count SHALL be approximately 450-850 words

#### Scenario: Scene emotion mapping
- **WHEN** Gemini generates scene data
- **THEN** each scene's `emotion` field SHALL be one of HeyGen's supported values: "Excited", "Friendly", "Serious", "Soothing", "Broadcaster"
- **AND** the emotion SHALL match the content of the scene (e.g., "Excited" for launch announcements, "Serious" for technical explanations)

#### Scenario: Default emotion from config
- **WHEN** the video configuration has a selected emotion
- **THEN** Gemini SHALL use it as the default emotion for most scenes
- **AND** MAY vary per-scene for natural delivery (e.g., start Friendly, shift to Excited for key features)

#### Scenario: Avatar style per scene
- **WHEN** the video uses Avatar IV engine
- **THEN** Gemini MAY suggest `avatarStyle` values per scene: "normal", "closeUp" (for intimate/emphasis moments), or "circle" (for intros/outros)
- **WHEN** the video uses Avatar III engine
- **THEN** `avatarStyle` SHALL always be "normal"

#### Scenario: Text overlay per scene (when enabled)
- **WHEN** text overlays are enabled in video configuration
- **THEN** Gemini SHALL generate concise `textOverlay` content for key scenes (not every scene)
- **AND** text overlays SHALL be short phrases (3-8 words) summarizing the key point
- **WHEN** text overlays are disabled
- **THEN** the `textOverlay` field SHALL be null/omitted for all scenes

### Requirement: Script length calibration
The system SHALL map video length settings to target word counts with per-scene distribution guidance.

#### Scenario: Length-to-word-count mapping
- 30s → ~70 words total, 1 scene
- 60s → ~160 words total, 1-2 scenes
- 90s → ~240 words total, 2-3 scenes
- 2m → ~320 words total, 2-4 scenes
- 3m → ~480 words total, 3-6 scenes
- 5m → ~800 words total, 5-10 scenes

#### Scenario: Per-scene word distribution
- **WHEN** generating a multi-scene script
- **THEN** each scene SHALL target 50-120 words for natural pacing
- **AND** scenes SHALL have clear narrative transitions

### Requirement: Manual instructions integration
When manual instructions are provided in the video configuration, the script generation prompt SHALL include them as additional context and direction for Gemini.

#### Scenario: Script with manual instructions
- **WHEN** script generation is called with manual instructions "Focus on the performance improvements and mention the 3x speed increase"
- **THEN** the system prompt SHALL include these instructions as user direction
- **AND** the generated script SHALL incorporate the specified focus

#### Scenario: Script with reference images
- **WHEN** script generation is called with reference images in manual instructions
- **THEN** the reference images SHALL be included in the Gemini call as visual context (Gemini supports multimodal input)

### Requirement: Character personality in script prompt
When character information is available (name, description, personality notes from video settings), the script generation prompt SHALL include it so Gemini can adapt the script to the presenter's style.

#### Scenario: Script adapted to character
- **WHEN** script generation is called with character info "Oz — casual, enthusiastic developer who uses humor"
- **THEN** the generated script SHALL reflect this personality in tone and word choice
- **AND** scene directions SHALL suggest appropriate gestures/expressions for the character

### Requirement: Dual caption generation
The script generation SHALL produce both an Instagram-optimized and a Twitter-optimized caption.

#### Scenario: Instagram caption
- **WHEN** script generation completes
- **THEN** the `caption` field SHALL contain an Instagram-optimized caption (max 2200 chars)
- **AND** include relevant hashtags based on repo context and content

#### Scenario: Twitter caption
- **WHEN** script generation completes
- **THEN** the `twitterCaption` field SHALL contain a Twitter-optimized caption (max 280 chars)
- **AND** be a concise, engaging version of the caption (not just truncated)

### Requirement: Script validation
The system SHALL validate the generated script before presenting it for approval.

#### Scenario: Word count validation
- **WHEN** Gemini returns a script
- **THEN** the system SHALL calculate total word count across all scenes
- **AND** warn the user if the script deviates more than 30% from the target word count

#### Scenario: Scene structure validation
- **WHEN** Gemini returns a script
- **THEN** the system SHALL validate that each scene has non-empty `scriptText` and a valid `emotion` value
- **AND** reject and retry if the structure is invalid

#### Scenario: Emotion value validation
- **WHEN** a scene has an emotion value
- **THEN** it SHALL be validated against the allowed set: "Excited", "Friendly", "Serious", "Soothing", "Broadcaster"
- **AND** invalid values SHALL be replaced with the config's default emotion
