# Image Generation Spec

## Requirements

### Requirement: On-demand image generation when viewing draft
The system SHALL generate an image when a user views a draft that has no image. When generating, the system SHALL pass the repo overview's `visual_theme` and `brand_voice` fields (if available) to the image generation prompt to ensure visual consistency across the repo's posts.

#### Scenario: First time viewing draft with repo overview
- **WHEN** user clicks View on a draft without an image, and the repo has an overview with visual_theme
- **THEN** the system SHALL generate an image via Gemini using the structured imagePrompt AND the repo's visual_theme for style consistency
- **AND** store the image in R2
- **AND** update draft.image_url

#### Scenario: First time viewing draft without repo overview
- **WHEN** user clicks View on a draft without an image, and the repo has no overview
- **THEN** the system SHALL generate an image via Gemini using only the structured imagePrompt (current behavior preserved)

#### Scenario: Viewing draft with existing image
- **WHEN** user clicks View on a draft with image_url set
- **THEN** the system SHALL fetch the image from R2
- **AND** display the image with draft content
- **AND** SHALL NOT call Gemini API

### Requirement: Image display in Telegram
The system SHALL display the generated image alongside draft content in Telegram.

#### Scenario: Draft has image
Given a draft with stored image
When rendering draft detail
Then send photo with caption containing draft preview
And include action buttons

#### Scenario: Draft has no image yet
Given a draft without image
When rendering draft detail
Then generate image first
Then send photo with caption

### Requirement: Webhook does not generate images
Webhook processing SHALL NOT generate images; image generation is deferred to view time.

#### Scenario: Push webhook received
Given a push event
When processing webhook
Then generate content via Grok
And create draft
And send notification
And do not generate image
