# Spec: Image Generation

## MODIFIED Requirements

### REQ-IMG-001: Grok Image Prompt Output
Grok content generation shall include imagePrompt in response.

#### Scenario: Content with image prompt
- Given content generation request
- When Grok generates tweets
- Then response includes `imagePrompt` field
- And imagePrompt is descriptive, context-aware text

## ADDED Requirements

### REQ-IMG-002: Immediate Image Generation
Image shall be generated immediately after content, not at publish.

#### Scenario: Draft creation with image
- Given content is generated successfully
- And repo config allows image generation
- When system processes content
- Then Grok Image API is called with imagePrompt
- And image is stored before draft notification

### REQ-IMG-003: Context-Aware Image Prompts
Image prompts shall include code context, not generic visuals.

#### Scenario: PR-based image
- Given PR with title "Add webhook handler"
- When Grok generates imagePrompt
- Then prompt includes repo name, key code changes
- And specifies visual style (holographic, code display, etc.)

### REQ-IMG-004: Image Generation Rules
Image generation shall follow repo config rules.

#### Scenario: Thread always gets image
- Given format is 'thread'
- And alwaysGenerateThreadImage is true
- When draft is created
- Then image is always generated

#### Scenario: Single tweet probability
- Given format is 'single'
- And singleTweetImageProbability is 0.7
- When draft is created
- Then image is generated 70% of the time
