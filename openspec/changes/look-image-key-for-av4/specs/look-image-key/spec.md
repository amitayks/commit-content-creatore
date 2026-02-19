## ADDED Requirements

### Requirement: HeyGenLook stores imageKey
Each `HeyGenLook` SHALL have an `imageKey: string` field that stores the `image_key` value returned by the HeyGen Upload Asset API. This field is used by the av4 video generation endpoint.

#### Scenario: Look created from photo upload
- **WHEN** a photo is uploaded via `uploadAsset()` and added to a character
- **THEN** the resulting look SHALL have `imageKey` set to the returned asset key

#### Scenario: Look with empty imageKey
- **WHEN** a look exists from sync but was never uploaded through our system
- **THEN** the look SHALL have `imageKey` set to empty string `''`

### Requirement: Character creation stores image_keys as initial looks
During character creation, after the avatar group is created from uploaded photos, the system SHALL persist the uploaded `image_key` values as initial looks on the character.

#### Scenario: Single photo character creation
- **WHEN** a user creates a character with 1 photo
- **THEN** the character SHALL have 1 look with `imageKey` set to the uploaded asset key, `talkingPhotoId` set to `''`, and `name` set to `'Photo 1'`

#### Scenario: Multi-photo character creation
- **WHEN** a user creates a character with N photos
- **THEN** the character SHALL have N looks, each with its respective `imageKey` from upload, `talkingPhotoId: ''`, and `name` set to `'Photo 1'` through `'Photo N'`

### Requirement: Add Look uses photo upload
The "Add Look" flow SHALL accept a photo upload (not an AI text prompt). The user sends a photo, which gets uploaded to HeyGen and added to the character's avatar group.

#### Scenario: User adds a look via photo
- **WHEN** user taps "Add Look" and sends a photo
- **THEN** the system SHALL upload the photo via `uploadAsset()`, call `addLooksToGroup()`, and store a new look with the `imageKey` from upload and `talkingPhotoId: ''`

#### Scenario: User sends text instead of photo
- **WHEN** user sends text during the add-look flow
- **THEN** the system SHALL prompt the user to send a photo instead

### Requirement: Sync looks merges with existing data
The `sync_looks` operation SHALL merge HeyGen's talking photo data into existing looks rather than replacing them, preserving stored `imageKey` values.

#### Scenario: Synced look matches existing look by name
- **WHEN** sync returns a talking photo whose name matches an existing look's name
- **THEN** the existing look's `talkingPhotoId` SHALL be updated and its `imageKey` SHALL be preserved

#### Scenario: Synced look has no matching existing look
- **WHEN** sync returns a talking photo that doesn't match any existing look
- **THEN** a new look SHALL be added with the synced `talkingPhotoId` and `imageKey: ''`

#### Scenario: Existing look not found in sync
- **WHEN** an existing look with `imageKey` is not found in sync results
- **THEN** the look SHALL be preserved (not removed) to retain its `imageKey`

### Requirement: Look selection populates imageKey on VideoConfig
When a user selects a look for video generation, `VideoConfig.imageKey` SHALL be set from the look's `imageKey` field.

#### Scenario: Look with imageKey selected
- **WHEN** user selects a look that has a non-empty `imageKey`
- **THEN** `config.imageKey` SHALL be set to that value

#### Scenario: Look without imageKey selected
- **WHEN** user selects a look that has empty `imageKey`
- **THEN** `config.imageKey` SHALL be set to `''`

### Requirement: Video generation validates imageKey
Before calling the av4 endpoint, the system SHALL verify that `config.imageKey` is present and non-empty.

#### Scenario: imageKey present
- **WHEN** user approves video generation and `config.imageKey` is non-empty
- **THEN** video generation SHALL proceed normally

#### Scenario: imageKey missing
- **WHEN** user approves video generation and `config.imageKey` is empty or missing
- **THEN** the system SHALL show an error message indicating the look needs a photo re-upload and SHALL NOT call the HeyGen API

## REMOVED Requirements

### Requirement: AI prompt-based look generation
**Reason**: The AI look generation endpoint (`/v2/photo_avatar/look/generate`) does not expose an `image_key` for the generated look. Since the av4 video endpoint requires `image_key`, AI-generated looks cannot be used for video generation.
**Migration**: Use photo upload to add new looks instead of AI prompts.
