## ADDED Requirements

### Requirement: Delete button on draft detail view
The draft detail view SHALL display a "🗑 Delete" button for drafts in ALL statuses: draft, approved, scheduled, published, rejected. The button SHALL appear in its own row, positioned after the status-specific action buttons and before the Back button.

#### Scenario: Delete button visible on draft status
- **WHEN** user views a draft with status "draft"
- **THEN** the action buttons include a "🗑 Delete" button with callback data `action:delete_draft:<draftId>`

#### Scenario: Delete button visible on published status
- **WHEN** user views a draft with status "published"
- **THEN** the action buttons include a "🗑 Delete" button with callback data `action:delete_draft:<draftId>`

#### Scenario: Delete button visible on all other statuses
- **WHEN** user views a draft with status "approved", "scheduled", or "rejected"
- **THEN** the action buttons include a "🗑 Delete" button with callback data `action:delete_draft:<draftId>`

### Requirement: Confirmation prompt before deletion
When the user taps Delete, the system SHALL show a confirmation prompt instead of immediately deleting. The confirmation prompt SHALL display the draft title and a warning that deletion is permanent. If the draft has an image, the image SHALL remain visible (via caption edit on photo messages).

#### Scenario: Tap delete shows confirmation
- **WHEN** user taps the "🗑 Delete" button on a draft detail view
- **THEN** the message is updated to show a confirmation prompt with "✅ Yes, Delete" and "❌ Cancel" buttons
- **AND** the confirmation text includes the draft title and a warning

#### Scenario: Confirmation preserves image on photo message
- **WHEN** user taps "🗑 Delete" on a draft displayed as a photo message
- **THEN** the photo remains visible and only the caption is updated to the confirmation prompt

### Requirement: Confirm deletion removes draft and image
When the user confirms deletion, the system SHALL delete the draft row from D1, delete any associated R2 image, and navigate to the draft categories view.

#### Scenario: Confirm delete removes draft from database
- **WHEN** user taps "✅ Yes, Delete" on the confirmation prompt
- **THEN** the draft is deleted from the D1 database
- **AND** the user is navigated to the draft categories view

#### Scenario: Confirm delete cleans up R2 image
- **WHEN** user confirms deletion of a draft that has an `image_url`
- **THEN** the corresponding R2 object is deleted
- **AND** the draft is still deleted even if R2 cleanup fails

#### Scenario: R2 cleanup failure does not block deletion
- **WHEN** R2 image deletion fails during draft deletion
- **THEN** the error is logged but the draft deletion completes successfully

### Requirement: Cancel returns to draft detail
When the user taps Cancel on the confirmation prompt, the system SHALL return to the draft detail view with the original content and buttons restored.

#### Scenario: Cancel returns to draft detail
- **WHEN** user taps "❌ Cancel" on the confirmation confirmation prompt
- **THEN** the message is updated back to the full draft detail view with all action buttons
