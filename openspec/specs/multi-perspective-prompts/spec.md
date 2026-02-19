## Requirements

### Requirement: Multi-perspective system prompt for content generation
The system prompt for `generateContent()` SHALL instruct Gemini to think from multiple expert perspectives before generating tweets and image prompts. The prompt SHALL NOT assign Gemini a single role ("you are a developer advocate") but instead ask it to consider what each expert would prioritize. When a repo overview is provided, the prompt SHALL instruct Gemini to ground all perspectives in the project's identity, audience, and brand voice from the overview.

#### Scenario: System prompt references tweet perspectives with overview context
- **WHEN** the system prompt is sent to Gemini for content generation with a repo overview
- **THEN** it SHALL include instructions to think from the perspectives of at least: Tech Influencer (engagement hooks for the specific audience), Copywriter (word impact within 280 chars), Growth Marketer (shareability within the project's community), and Community Manager (dev community resonance matching the project's brand voice)

#### Scenario: System prompt references image perspectives with visual theme
- **WHEN** the system prompt is sent to Gemini for content generation with a repo overview containing a visual_theme
- **THEN** it SHALL include instructions to think from the perspectives of Creative Director (visual story aligned with project identity), Art Director (emotional impact), and Brand Designer (visual consistency using the repo's visual_theme and brand colors)

#### Scenario: System prompt works without overview
- **WHEN** the system prompt is sent to Gemini for content generation without a repo overview
- **THEN** it SHALL use the existing multi-perspective approach without project-specific grounding (backwards compatible)

### Requirement: Perspective-based prompting pattern
The system prompt SHALL use the pattern "Think from the perspective of X -- what would they prioritize?" rather than "You are X". It SHALL ask Grok to synthesize insights from all perspectives into its final output.

#### Scenario: Prompt uses perspective framing
- **WHEN** the system prompt text is examined
- **THEN** it uses language like "think from the perspective of" or "what would a [role] prioritize" rather than "you are a [role]"

#### Scenario: Prompt asks for synthesis
- **WHEN** the system prompt text is examined
- **THEN** it explicitly asks Grok to synthesize the multiple perspectives into one cohesive output

### Requirement: Response format is strict JSON
The system prompt SHALL instruct Gemini to respond ONLY with valid JSON containing `format` (single/thread), `tweets` (array of {text, index}), `imagePrompt` (ImagePromptData object), and `overviewUpdates` (field-level patch object or null). No prose, no markdown, no explanation outside the JSON.

#### Scenario: Valid JSON response with structured imagePrompt and overviewUpdates
- **WHEN** Gemini responds to a content generation prompt that included a repo overview
- **THEN** the response SHALL be valid JSON with `format`, `tweets`, `imagePrompt`, and `overviewUpdates`
- **AND** `overviewUpdates` SHALL be either `null` (no changes) or an object with field-level patches

#### Scenario: overviewUpdates absent when no overview provided
- **WHEN** Gemini responds to a content generation prompt without a repo overview
- **THEN** the response SHALL be valid JSON with `format`, `tweets`, and `imagePrompt`
- **AND** `overviewUpdates` SHALL be `null` or absent

### Requirement: Unified prompt for tweets and image
The system prompt SHALL handle tweet generation, image prompt generation, and overview patch generation in a single unified prompt. It SHALL frame the task as creating a complete social media package (content + visual) for a code change, with project context awareness.

#### Scenario: Single API call produces tweets, image prompt, and overview patches
- **WHEN** `generateContent()` is called with repo overview available
- **THEN** a single Gemini API call SHALL return the tweets array, the structured imagePrompt, and any overviewUpdates

### Requirement: Edit prompt uses same creative approach
The `editContent()` system prompt SHALL use the same multi-perspective creative approach as the generation prompt, adapted for the editing context.

#### Scenario: Edit prompt includes perspective thinking
- **WHEN** `editContent()` sends a system prompt to Grok
- **THEN** it includes multi-perspective instructions for refining both tweets and image prompt

### Requirement: Overview patch generation instructions in system prompt
The system prompt SHALL instruct Gemini to analyze the commit changes against the current overview and return field-level patches when the changes represent meaningful project evolution. The prompt SHALL specify the patch format and instruct Gemini to return `null` for unchanged fields, avoiding unnecessary overwrites.

#### Scenario: Breaking change triggers overview patch
- **WHEN** commit messages indicate a major feature addition or architectural change
- **THEN** Gemini SHALL return `overviewUpdates` with patches to relevant fields (e.g., adding to key_features, updating summary)

#### Scenario: Minor fix does not trigger overview patch
- **WHEN** commit messages indicate a small bug fix or typo correction
- **THEN** Gemini SHALL return `overviewUpdates: null`

#### Scenario: Recent changes always updated
- **WHEN** any content is generated with a repo overview present
- **THEN** `overviewUpdates.recent_changes` SHALL include a brief description of the current change added to the array
