## ADDED Requirements

### Requirement: Commit depth toggle
The video configuration SHALL include a commit depth selector with options: 0 (overview only), 1 (latest commit), 3 (last 3), 5 (last 5), "Since last video", and "Custom". The depth determines how many recent commits are included in the script generation context.

#### Scenario: Commit depth 0
- **WHEN** user sets commit depth to 0
- **THEN** the script generation SHALL use only the repo overview without any commit messages

#### Scenario: Commit depth 3
- **WHEN** user sets commit depth to 3
- **THEN** the script generation SHALL include the 3 most recent commit messages and file names for the repo

#### Scenario: Since last video
- **WHEN** user selects "Since last video"
- **THEN** the system SHALL find the last published video for this repo and include all commits since that video's reference SHA

#### Scenario: Since last video with no previous video
- **WHEN** user selects "Since last video" and no previous video exists for this repo
- **THEN** the system SHALL fall back to "Last 5" and notify the user

### Requirement: Tone selector
The video configuration SHALL include a tone selector with options: "Casual Update", "Professional Announcement", "Technical Deep Dive", "Excited Launch", and "Community Chat".

#### Scenario: Tone selection
- **WHEN** user selects a tone option
- **THEN** the selection SHALL be stored in the video configuration
- **AND** the script generation prompt SHALL use the tone to guide writing style and pacing

### Requirement: Manual instructions input
The video configuration SHALL include a manual instructions option that opens a compose-mode input flow (similar to handwrite mode). The user can send multiple messages as instructions, attach reference images, and click "Save" when done.

#### Scenario: Enter manual instructions mode
- **WHEN** user clicks "Manual Instructions" in video config
- **THEN** the bot SHALL enter a compose mode where subsequent messages are buffered as instructions

#### Scenario: Add text instructions
- **WHEN** user sends text messages while in manual instructions mode
- **THEN** each message SHALL be appended to the instructions buffer

#### Scenario: Add reference image
- **WHEN** user sends a photo while in manual instructions mode
- **THEN** the image SHALL be stored in R2 and referenced in the instructions

#### Scenario: Save instructions
- **WHEN** user clicks "Save" in manual instructions mode
- **THEN** the buffered instructions SHALL be stored in the video configuration
- **AND** the bot SHALL exit compose mode and return to the configuration view

#### Scenario: Cancel instructions
- **WHEN** user clicks "Cancel" or sends a slash command while in manual instructions mode
- **THEN** the buffered instructions SHALL be discarded
- **AND** the bot SHALL return to the configuration view

### Requirement: Character selector
The video configuration SHALL include a character selector displaying available HeyGen characters configured in video settings. Each character is shown with its name and status.

#### Scenario: Select character
- **WHEN** user clicks a character button
- **THEN** the character's HeyGen group ID and default talking photo ID SHALL be stored in the video configuration
- **AND** the character's default voice_id and emotion SHALL be loaded as defaults

#### Scenario: No characters configured
- **WHEN** user opens character selector and no characters are configured in settings
- **THEN** the view SHALL show a message directing the user to configure characters in video settings first

#### Scenario: Character with multiple looks
- **WHEN** user selects a character that has multiple looks
- **THEN** the look selector SHALL automatically open showing available looks

### Requirement: Look selector
The video configuration SHALL include a look/outfit selector displaying available looks for the selected character, as configured in video settings.

#### Scenario: Select look
- **WHEN** user clicks a look button
- **THEN** the look's HeyGen `talking_photo_id` SHALL be stored in the video configuration

#### Scenario: Character has no additional looks
- **WHEN** user opens look selector and the selected character has only the default look
- **THEN** the system SHALL use the character's default look automatically

### Requirement: Aspect ratio toggle
The video configuration SHALL include an aspect ratio toggle with options: "9:16 Reel" (portrait), "16:9 Landscape", and "1:1 Square".

#### Scenario: Aspect ratio selection
- **WHEN** user selects an aspect ratio
- **THEN** the selection SHALL be stored in the video configuration
- **AND** the HeyGen API call SHALL map this to pixel dimensions:
  - "9:16 Reel" → `{ width: 1080, height: 1920 }`
  - "16:9 Landscape" → `{ width: 1920, height: 1080 }`
  - "1:1 Square" → `{ width: 1080, height: 1080 }`

### Requirement: Length selector
The video configuration SHALL include a length selector with fixed options: 30s, 60s, 90s, 2m, 3m, 5m.

#### Scenario: Length selection
- **WHEN** user selects a video length
- **THEN** the selection SHALL be stored in the video configuration
- **AND** the script generation prompt SHALL calibrate script length accordingly

#### Scenario: Length exceeds max setting
- **WHEN** user selects a length exceeding the max video length configured in video settings
- **THEN** the option SHALL NOT be displayed in the selector

### Requirement: Voice emotion selector
The video configuration SHALL include a voice emotion selector with HeyGen's supported emotions: "Excited", "Friendly", "Serious", "Soothing", "Broadcaster".

#### Scenario: Emotion selection
- **WHEN** user selects an emotion
- **THEN** the selection SHALL be stored as the default emotion for all scenes in this video
- **AND** Gemini MAY override per-scene in the multi-scene script output

#### Scenario: Default emotion from character
- **WHEN** user selects a character with a configured default emotion
- **THEN** the emotion selector SHALL pre-populate with the character's default
- **AND** user can override for this specific video

### Requirement: Engine selector (Avatar III / Avatar IV)
The video configuration SHALL include an engine toggle between Avatar III and Avatar IV.

#### Scenario: Engine selection
- **WHEN** user selects "Avatar III"
- **THEN** the config SHALL set engine to "avatar_iii"
- **AND** display credit cost indicator: "~1 credit/min"
- **WHEN** user selects "Avatar IV"
- **THEN** the config SHALL set engine to "avatar_iv"
- **AND** display credit cost indicator: "~6 credits/min"

#### Scenario: Default engine from settings
- **WHEN** a default engine is configured in video settings
- **THEN** the engine selector SHALL pre-populate with the default

#### Scenario: Avatar style options (Avatar IV only)
- **WHEN** Avatar IV is selected
- **THEN** an additional "Avatar Style" selector SHALL appear with options: "Normal", "Close Up", "Circle"
- **WHEN** Avatar III is selected
- **THEN** avatar style SHALL be locked to "Normal" (no selector shown)

### Requirement: Background configuration
The video configuration SHALL include a background option with choices: "Default" (from settings), "Color", and "Image URL".

#### Scenario: Background color
- **WHEN** user selects "Color" and provides a hex color code
- **THEN** the background config SHALL be stored as `{ type: 'color', value: '#HEXCODE' }`

#### Scenario: Background image
- **WHEN** user selects "Image URL" and provides a URL
- **THEN** the background config SHALL be stored as `{ type: 'image', value: 'url' }`

#### Scenario: Default background
- **WHEN** user selects "Default"
- **THEN** the background from video settings defaults SHALL be used

### Requirement: Captions toggle
The video configuration SHALL include a toggle for burning captions (subtitles) into the video via HeyGen's built-in caption feature.

#### Scenario: Enable captions
- **WHEN** user enables the captions toggle
- **THEN** the config SHALL set `captions: true`
- **AND** HeyGen will burn subtitles directly into the generated video

#### Scenario: Disable captions
- **WHEN** user disables the captions toggle
- **THEN** the config SHALL set `captions: false`
- **AND** the generated video will have no burned-in subtitles

#### Scenario: Default captions from settings
- **WHEN** a default captions setting exists in video settings
- **THEN** the toggle SHALL pre-populate with the default value

### Requirement: Text overlay toggle
The video configuration SHALL include a toggle for enabling text overlays (key points displayed on screen during the video).

#### Scenario: Enable text overlays
- **WHEN** user enables text overlays
- **THEN** the Gemini script prompt SHALL instruct to generate `textOverlay` content per scene
- **AND** each scene's text overlay SHALL be included in the HeyGen API call

#### Scenario: Disable text overlays
- **WHEN** user disables text overlays
- **THEN** no text overlay data SHALL be generated or sent to HeyGen

### Requirement: Create Video button triggers script generation
After all configuration is set, the "Create Video" button SHALL trigger script generation via Gemini and display a script preview for approval.

#### Scenario: Create Video with valid configuration
- **WHEN** user clicks "Create Video" with all required fields set (at minimum: character, tone, and length)
- **THEN** the system SHALL call Gemini for script generation with the configured parameters
- **AND** display the generated script as a preview message

#### Scenario: Create Video with missing required fields
- **WHEN** user clicks "Create Video" without selecting a character
- **THEN** the system SHALL show an error message indicating which fields are missing

### Requirement: Script preview and approval
After script generation, the system SHALL display the script text with action buttons and credit cost estimate.

#### Scenario: Script preview display
- **WHEN** script generation completes
- **THEN** the preview SHALL show:
  - Video title
  - Full script text (or truncated with "..." for very long scripts)
  - Per-scene breakdown with emotions (if multi-scene)
  - Caption text
  - Estimated credit cost (based on word count and engine)
  - Action buttons: "Approve & Generate", "Regenerate Script", "Edit Config", "Cancel"

#### Scenario: Approve script
- **WHEN** user clicks "Approve & Generate" on the script preview
- **THEN** the system SHALL send the script to HeyGen for video generation
- **AND** create a video draft with status "generating" (or "queued" if another is generating)
- **AND** display a confirmation with the queue position or generation start notice

#### Scenario: Regenerate script
- **WHEN** user clicks "Regenerate Script"
- **THEN** the system SHALL call Gemini again with the same configuration
- **AND** display the new script preview

#### Scenario: Cancel
- **WHEN** user clicks "Cancel" on the script preview
- **THEN** no video draft SHALL be created
- **AND** the user SHALL return to the video configuration view

### Requirement: Preset save and load
The video configuration SHALL support saving the current configuration as a named preset and loading previously saved presets.

#### Scenario: Save preset
- **WHEN** user clicks "Save as Preset" and provides a name
- **THEN** the current configuration (tone, length, character, look, aspect ratio, commit depth, engine, emotion, background, captions, text overlay) SHALL be stored in `video_presets` table

#### Scenario: Load preset
- **WHEN** user clicks "Load Preset" and selects a saved preset
- **THEN** all configuration fields SHALL be populated from the preset values
- **AND** the user can still modify individual fields before creating

#### Scenario: Delete preset
- **WHEN** user clicks "Delete" on a preset
- **THEN** the preset SHALL be removed from `video_presets` table

### Requirement: Configuration summary display
The video configuration view SHALL display a summary of all currently selected options.

#### Scenario: Config summary
- **WHEN** user views the configuration screen
- **THEN** the current selections SHALL be displayed:
  - Character: name + look name
  - Tone: selected tone
  - Length: selected duration
  - Engine: Avatar III/IV with credit indicator
  - Aspect Ratio: selected ratio
  - Emotion: selected emotion
  - Background: type and value
  - Captions: on/off
  - Text Overlays: on/off
  - Manual Instructions: "Set" / "Not set"
  - Commit Depth: selected depth
