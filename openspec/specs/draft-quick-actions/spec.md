## ADDED Requirements

### Requirement: Two-row layout per draft in list views
Each draft item in `renderDraftsList` SHALL render two rows of inline buttons: the first row is the full-width title button (navigates to draft detail), and the second row contains quick-action buttons side by side.

#### Scenario: Draft with status "draft" shows approve and delete
- **WHEN** a draft list is rendered containing a draft with status "draft"
- **THEN** the draft item has two rows: `[title button]` and `[✅] [🗑]`
- **AND** ✅ has callback `action:list_approve:<draftId>:<listType>:<page>`
- **AND** 🗑 has callback `action:list_delete:<draftId>:<listType>:<page>`

#### Scenario: Draft with status "approved" shows publish and delete
- **WHEN** a draft list is rendered containing a draft with status "approved"
- **THEN** the draft item has two rows: `[title button]` and `[📤] [🗑]`
- **AND** 📤 has callback `action:list_publish:<draftId>:<listType>:<page>`

#### Scenario: Draft with status "published" shows only delete
- **WHEN** a draft list is rendered containing a draft with status "published"
- **THEN** the draft item has two rows: `[title button]` and `[🗑]`

#### Scenario: Draft with status "scheduled" shows only delete
- **WHEN** a draft list is rendered containing a draft with status "scheduled"
- **THEN** the draft item has two rows: `[title button]` and `[🗑]`

#### Scenario: Draft with status "rejected" shows only delete
- **WHEN** a draft list is rendered containing a draft with status "rejected"
- **THEN** the draft item has two rows: `[title button]` and `[🗑]`

### Requirement: Quick approve from list
The system SHALL allow approving a draft directly from the list view. After approval, the list SHALL re-render showing the draft's updated status with a publish button.

#### Scenario: Quick approve updates list in place
- **WHEN** user taps ✅ on a draft in the list
- **THEN** the draft status is updated to "approved" in the database
- **AND** the list is re-rendered on the same page
- **AND** the draft's quick-action row now shows `[📤] [🗑]` instead of `[✅] [🗑]`

### Requirement: Quick publish from list
The system SHALL allow publishing an approved draft directly from the list view.

#### Scenario: Quick publish publishes and re-renders list
- **WHEN** user taps 📤 on an approved draft in the list
- **THEN** the draft is published to X
- **AND** the list is re-rendered on the same page

### Requirement: Quick delete from list with confirmation
The system SHALL show a confirmation prompt before deleting a draft from the list view.

#### Scenario: Quick delete shows confirmation
- **WHEN** user taps 🗑 on a draft in the list
- **THEN** the message is updated to a confirmation prompt showing the draft title
- **AND** confirmation buttons are `[✅ Yes, Delete] [❌ Cancel]`
- **AND** both buttons encode the list context for return navigation

#### Scenario: Confirm delete removes draft and re-renders list
- **WHEN** user confirms deletion from the list confirmation prompt
- **THEN** the draft and its R2 image are deleted
- **AND** the list is re-rendered on the same page

#### Scenario: Cancel delete returns to list
- **WHEN** user cancels deletion from the list confirmation prompt
- **THEN** the list is re-rendered on the same page without changes
