# On-Demand Image Generation

## Why
Currently, image generation happens during webhook processing which often times out. Images are stored in R2 but never displayed. This leads to:
- Webhook timeouts during image generation
- No image preview for users reviewing drafts
- Slower publishing due to generating images at publish time

## What Changes
Move image generation from webhook to on-demand when viewing drafts:
1. **Remove webhook image generation** - webhook only creates draft + sends notification
2. **Generate on View** - when user clicks View, check for existing image or generate new
3. **Display image in draft view** - attach image to the draft message dynamically
4. **Use cached image on publish** - pull from R2 instead of generating, faster publishing
