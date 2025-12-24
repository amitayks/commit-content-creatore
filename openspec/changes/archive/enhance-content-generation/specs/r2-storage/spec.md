# Spec: R2 Storage

## ADDED Requirements

### REQ-R2-001: R2 Bucket Configuration
Worker shall have R2 bucket binding for image storage.

#### Scenario: Bucket access
- Given wrangler.toml has R2 binding `IMAGES`
- When worker accesses `env.IMAGES`
- Then R2 bucket operations are available

### REQ-R2-002: Image Upload
Generated images shall be uploaded to R2.

#### Scenario: Store image
- Given image data from Grok (base64 or URL)
- When storing to R2
- Then key is `drafts/{draft_id}/image.png`
- And public URL is returned

### REQ-R2-003: Image URL in D1
D1 draft record shall store R2 image URL.

#### Scenario: Draft with image
- Given image uploaded to R2
- When draft is saved/updated
- Then D1 `image_url` field contains R2 public URL

### REQ-R2-004: Telegram Preview
Draft preview in Telegram shall include image.

#### Scenario: Show draft with image
- Given draft has image_url set
- When rendering draft detail or notification
- Then Telegram message includes image

### REQ-R2-005: Image Cleanup
R2 image shall be deleted when draft is deleted.

#### Scenario: Draft deletion
- Given draft with image in R2
- When draft is deleted
- Then R2 object is also deleted

### REQ-R2-006: Publish from R2
Publishing shall fetch image from R2 for X upload.

#### Scenario: Publish with image
- Given approved draft with image_url
- When publishing to X
- Then image is fetched from R2
- And uploaded to X media API
