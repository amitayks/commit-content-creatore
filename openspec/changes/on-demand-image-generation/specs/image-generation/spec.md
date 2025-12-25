# Image Generation Spec

## ADDED Requirements

### Requirement: On-demand image generation when viewing draft
The system SHALL generate an image when a user views a draft that has no image.

#### Scenario: First time viewing draft
Given a draft without an image
When user clicks View
Then system generates image via Grok
And stores in R2
And updates draft.image_url
And displays image with draft content

#### Scenario: Viewing draft with existing image
Given a draft with image_url set
When user clicks View
Then system fetches image from R2
And displays image with draft content
And does not call Grok API

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

## MODIFIED Requirements

### Requirement: Webhook does not generate images
Webhook processing SHALL NOT generate images; image generation is deferred to view time.

#### Scenario: Push webhook received
Given a push event
When processing webhook
Then generate content via Grok
And create draft
And send notification
And do not generate image
