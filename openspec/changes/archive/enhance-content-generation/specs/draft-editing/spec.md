# Spec: Draft Editing

## ADDED Requirements

### REQ-EDIT-001: Edit Button Flow
The Edit button on draft detail view shall initiate an edit session.

#### Scenario: User initiates edit
- Given a draft in 'draft' status
- When user clicks Edit button
- Then bot prompts "What changes would you like to make?"
- And context is set to `awaiting_input: 'edit_draft'`

### REQ-EDIT-002: Instruction Processing
User's text message shall be sent to Grok with original context.

#### Scenario: User provides edit instruction
- Given context `awaiting_input: 'edit_draft'` with `selected_draft_id`
- When user sends a text message
- Then system loads original draft and ContentSource
- And sends to Grok: original content + user instruction
- And Grok returns refined content

### REQ-EDIT-003: Draft Update
Same draft ID shall be updated with refined content.

#### Scenario: Successful edit
- Given Grok returns valid refined content
- When system processes response
- Then draft content is updated (same ID)
- And updated_at timestamp is refreshed
- And user sees updated draft detail

### REQ-EDIT-004: Image Regeneration on Edit
If configured, image shall be regenerated after edit.

#### Scenario: Edit triggers image regen
- Given repo config `alwaysGenerateThreadImage: true`
- When draft is successfully edited
- Then new image is generated from updated content
- And old image is replaced in R2
