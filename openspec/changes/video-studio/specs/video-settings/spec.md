## ADDED Requirements

### Requirement: Video settings section in bot settings
The bot settings view SHALL include a "Video Settings" section with subsections for: Characters & Looks, Voice Configuration, Default Settings, HeyGen Account, and Instagram Config.

#### Scenario: Video settings navigation
- **WHEN** user navigates to bot settings
- **THEN** a "Video Settings" button SHALL be displayed
- **WHEN** user clicks "Video Settings"
- **THEN** subsection buttons SHALL be displayed: "Characters", "Voices", "Defaults", "HeyGen Account", "Instagram"

### Requirement: Character creation through the bot
The video settings SHALL support creating HeyGen Photo Avatars directly through the Telegram bot, guiding the user through the full creation flow.

#### Scenario: Start character creation
- **WHEN** user clicks "Add Character" in video settings
- **THEN** the bot SHALL enter a character creation compose mode
- **AND** prompt the user: "Send me a clear, front-facing photo of the person. The photo should be well-lit, high resolution, and show the face clearly."

#### Scenario: Photo upload for character
- **WHEN** user sends a photo in character creation mode
- **THEN** the bot SHALL upload the photo to HeyGen via `POST /v2/assets`
- **AND** display "Photo uploaded! Now enter a display name for this character:"

#### Scenario: Name input for character
- **WHEN** user sends a text message with the character name
- **THEN** the bot SHALL call `createAvatarGroup(env, assetId, name)` to create the avatar group on HeyGen
- **AND** display "Avatar group created! Training your first look... (this costs 4 credits and may take a few minutes)"
- **AND** call `generateTalkingPhoto(env, groupId, 'Default')` to create the default look

#### Scenario: Training progress notification
- **WHEN** the avatar training completes (via polling or webhook)
- **THEN** the bot SHALL notify the user: "Character '{name}' is ready! You can now add more looks or start creating videos."
- **AND** store the character record: `{ heygenGroupId, name, defaultTalkingPhotoId, createdAt }`

#### Scenario: Training failure
- **WHEN** avatar training fails on HeyGen
- **THEN** the bot SHALL notify the user with the failure reason
- **AND** suggest retrying with a different photo (better lighting, different angle)

#### Scenario: Photo quality guidance
- **WHEN** user enters character creation mode
- **THEN** the prompt SHALL include photo requirements:
  - Front-facing, centered face
  - Good lighting, no harsh shadows
  - High resolution (minimum 512x512)
  - Neutral or slight smile expression
  - Plain or simple background preferred

### Requirement: Character listing and management
The video settings SHALL display all configured characters with management actions.

#### Scenario: List characters
- **WHEN** user views the characters section in video settings
- **THEN** all configured characters SHALL be displayed with their names and status (ready/training/failed)
- **AND** each character SHALL have "Looks", "Edit", and "Remove" buttons

#### Scenario: Edit character
- **WHEN** user clicks "Edit" on a character
- **THEN** the bot SHALL allow editing the display name and personality description
- **AND** the personality description is used by Gemini to adapt script tone

#### Scenario: Remove character
- **WHEN** user clicks "Remove" on a character
- **THEN** the character SHALL be removed from the local configuration
- **AND** a confirmation prompt SHALL be shown first
- **AND** existing video drafts using that character SHALL NOT be affected
- **AND** the HeyGen avatar group is NOT deleted (user can do that in HeyGen dashboard)

### Requirement: Look creation through the bot
The video settings SHALL support creating additional looks for existing characters through the bot.

#### Scenario: Add look to character
- **WHEN** user clicks "Add Look" for a specific character
- **THEN** the bot SHALL prompt: "Enter a name for this look (e.g., 'Casual', 'Professional', 'Studio'):"

#### Scenario: Look name input
- **WHEN** user provides a look name
- **THEN** the bot SHALL call `generateTalkingPhoto(env, groupId, lookName)` on HeyGen
- **AND** display "Generating look '{lookName}'... This costs 4 credits and may take a few minutes."

#### Scenario: Look creation complete
- **WHEN** the look generation completes
- **THEN** the bot SHALL notify the user and store: `{ talkingPhotoId, name, characterGroupId }`
- **AND** the look becomes selectable in video configuration

#### Scenario: List looks for character
- **WHEN** user clicks "Looks" on a character
- **THEN** all configured looks SHALL be displayed with names
- **AND** each look SHALL have a "Remove" button

#### Scenario: Remove look
- **WHEN** user clicks "Remove" on a look
- **THEN** the look SHALL be removed from local configuration
- **AND** a confirmation SHALL be shown first

### Requirement: Voice configuration per character
The video settings SHALL allow configuring a default voice for each character.

#### Scenario: Set character voice
- **WHEN** user clicks "Set Voice" on a character
- **THEN** the bot SHALL display available voices fetched from HeyGen's `GET /v2/voices`
- **AND** voices SHALL be grouped by language and show name + gender

#### Scenario: Voice selection
- **WHEN** user selects a voice from the list
- **THEN** the `voice_id` SHALL be stored with the character configuration
- **AND** this voice SHALL be used by default when creating videos with this character

#### Scenario: Default emotion per character
- **WHEN** user configures a character's voice
- **THEN** a default emotion selector SHALL be shown: Excited, Friendly, Serious, Soothing, Broadcaster
- **AND** the selected emotion SHALL be used as default for new video scenes (overridable per-video)

### Requirement: Default video settings
The video settings SHALL allow configuring defaults that pre-populate new video configurations.

#### Scenario: Set default aspect ratio
- **WHEN** user selects a default aspect ratio in video settings
- **THEN** new video configurations SHALL pre-populate with this aspect ratio

#### Scenario: Set max video length
- **WHEN** user sets max video length (e.g., 3m)
- **THEN** the length selector in video configuration SHALL NOT show options exceeding the max

#### Scenario: Set default character
- **WHEN** user selects a default character in video settings
- **THEN** new video configurations SHALL pre-populate with this character and its default look

#### Scenario: Set default engine
- **WHEN** user selects a default engine (Avatar III or Avatar IV)
- **THEN** new video configurations SHALL pre-populate with this engine
- **AND** Avatar III (1 credit/min) SHALL be the system default if not set

#### Scenario: Set default background
- **WHEN** user configures a default background color or image
- **THEN** new video configurations SHALL pre-populate with this background

#### Scenario: Set default captions toggle
- **WHEN** user enables/disables default captions
- **THEN** new video configurations SHALL pre-populate with this captions setting

### Requirement: HeyGen account configuration
The video settings SHALL show HeyGen account status and allow configuring the API key.

#### Scenario: Display account status
- **WHEN** user views HeyGen account settings
- **THEN** the bot SHALL display: API key status (configured/not configured), account plan info if available

#### Scenario: Configure API key
- **WHEN** user clicks "Set API Key"
- **THEN** the bot SHALL enter a compose mode to receive the API key
- **AND** validate the key by making a test API call
- **AND** store the key in environment configuration

#### Scenario: Credit cost reference
- **WHEN** user views HeyGen account settings
- **THEN** the bot SHALL display credit cost reference:
  - Avatar III: 1 credit per minute of video
  - Avatar IV: 6 credits per minute of video
  - Photo Avatar training: 4 credits per look

### Requirement: Instagram credentials configuration
The video settings SHALL allow configuring Instagram API credentials for Reels publishing.

#### Scenario: Configure Instagram credentials
- **WHEN** user enters Instagram Business Account ID and Access Token in video settings
- **THEN** the credentials SHALL be stored securely
- **AND** a test API call SHALL be made to verify the credentials are valid

#### Scenario: Instagram not configured
- **WHEN** Instagram credentials are not configured
- **THEN** the video publish flow SHALL only show Twitter as a publishing option
- **AND** Instagram SHALL be greyed out with "Not configured" label

#### Scenario: Token expiry warning
- **WHEN** the Instagram access token is within 7 days of expiry
- **THEN** the bot SHALL notify the user during video publish operations
- **AND** display a warning in video settings
