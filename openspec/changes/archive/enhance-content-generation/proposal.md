# Proposal: Enhance Content Generation

## Summary
Comprehensive enhancement to content generation: draft editing via Grok, advanced repo configuration, smart image generation with R2 storage for preview.

## Motivation
- Users cannot edit generated drafts - only regenerate entirely
- Images are generated only at publish time - no preview
- Content generation lacks context (no code diffs, single language)
- No control over thread/image behavior

## Proposed Changes

### 1. Draft Editing
User clicks Edit → enters instructions → Grok refines draft content → same draft ID updated.

### 2. Enhanced Repo Configuration
New config options:
- **codeContext**: `metadata` | `with_diff` | `with_files` | `with_folder`
- **language**: `en` | `he` (different prompts per language)
- **minCommitsForThread**: number (default 3)
- **maxTweets**: number (default 10)
- **alwaysGenerateThreadImage**: boolean
- **singleTweetImageProbability**: number (0-1)

### 3. Smart Image Generation
- Grok generates image prompt as part of content output
- Image generated immediately after content
- Stored in R2, URL saved to D1

### 4. R2 Storage Integration
- New R2 bucket for images
- Images stored with draft, sent via Telegram for preview
- Fetched from R2 when publishing to X

## Scope
- `cloudflare-bot/src/types.ts` - Extended RepoConfig
- `cloudflare-bot/src/services/grok.ts` - Edit flow, image prompt extraction
- `cloudflare-bot/src/services/r2.ts` - NEW: R2 operations
- `cloudflare-bot/src/services/github.ts` - Code context fetching
- `cloudflare-bot/src/handlers/message.ts` - Edit input handling
- `cloudflare-bot/src/handlers/callback.ts` - Edit button flow
- `cloudflare-bot/src/views/index.ts` - Config UI for new options
- `cloudflare-bot/wrangler.toml` - R2 bucket binding

## Out of Scope
- Multi-language prompts (Hebrew) - Phase 2
- Folder-level context fetching - Phase 2
- Advanced visual types (diagrams, flowcharts) - Phase 2
