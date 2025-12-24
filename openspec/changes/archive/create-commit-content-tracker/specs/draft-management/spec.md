## ADDED Requirements

### Requirement: Draft Storage
The system SHALL persist generated content as drafts in JSON files.

#### Scenario: Draft Creation
- **WHEN** content is successfully generated
- **THEN** a draft object is created with unique ID
- **AND** stored in data/drafts/{id}.json
- **AND** status is set to "draft"

#### Scenario: Draft Retrieval
- **WHEN** a draft is requested by ID
- **THEN** the system reads and returns the draft object
- **AND** includes all content and metadata

#### Scenario: Draft Listing
- **WHEN** pending drafts are requested
- **THEN** the system returns all drafts with status "draft" or "approved"
- **AND** sorts by creation date (newest first)

---

### Requirement: Status Workflow
The system SHALL manage draft status transitions through an approval workflow.

#### Scenario: Approval Transition
- **WHEN** a draft is approved
- **THEN** status changes from "draft" to "approved"
- **AND** updatedAt is set to current timestamp

#### Scenario: Rejection Transition
- **WHEN** a draft is rejected
- **THEN** status changes from "draft" to "rejected"
- **AND** optional rejection reason is stored

#### Scenario: Publishing Transition
- **WHEN** an approved draft is published
- **THEN** status changes from "approved" to "published"
- **AND** publishedTweetId is stored
- **AND** draft is moved to data/published/ archive

#### Scenario: Invalid Transition
- **WHEN** an invalid status transition is attempted (e.g., draft → published)
- **THEN** the system rejects the transition
- **AND** returns an error explaining valid transitions

---

### Requirement: Content Modification
The system SHALL support editing draft content before approval.

#### Scenario: Tweet Edit
- **WHEN** a specific tweet in a draft is edited
- **THEN** the tweet text is updated
- **AND** character count is validated
- **AND** updatedAt is refreshed

#### Scenario: Regeneration
- **WHEN** regeneration is requested for a draft
- **THEN** a new AI generation is triggered with same source context
- **AND** regenerationCount is incremented
- **AND** new content replaces previous content

---

### Requirement: Archive Management
The system SHALL archive and cleanup old published content.

#### Scenario: Archive on Publish
- **WHEN** a draft is published
- **THEN** it is moved to data/published/{date}-{id}.json
- **AND** removed from data/drafts/

#### Scenario: Archive Cleanup
- **WHEN** the cleanup workflow runs
- **THEN** archived content older than 90 days is deleted
- **AND** deletion is logged
