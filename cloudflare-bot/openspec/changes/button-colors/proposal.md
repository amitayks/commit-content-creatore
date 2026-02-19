## Why

Telegram Bot API 9.4 introduced colored inline buttons (`style` field: "primary", "success", "danger"). Our bot currently relies solely on emojis (✅, ❌, 🗑️) to convey button intent. Colored buttons provide clearer visual hierarchy — green for approve, blue for primary actions, red for destructive — and let us drop redundant emojis where color alone communicates intent.

## What Changes

- Add optional `style` field to the `InlineButton` type interface
- Pass `style` through to Telegram's `inline_keyboard` in `sendMessage`/`editMessageText`
- Update ~40-50 buttons across 9 view files with appropriate color styles
- Remove redundant emojis where button color alone conveys meaning (e.g., ✅/❌ on toggles, 🗑️ on delete)
- Keep emojis where they add categorical meaning beyond color (e.g., 📦 Repos, ⚡ Generate, 🏠 Home)

## Capabilities

### New Capabilities

_(none — this is a UI polish, not a new capability)_

### Modified Capabilities

_(no spec-level behavior changes — only visual presentation)_

## Impact

- `src/types.ts` — `InlineButton` interface gains optional `style` field
- `src/services/telegram.ts` — keyboard serialization must include `style` when present
- `src/views/*.ts` — all 9 view files updated with style annotations
- `src/views/repos.ts`, `src/views/accounts.ts` — toggle buttons switch from emoji-based to color-based on/off indication
- `src/actions/config-toggle.ts` — no change needed (views handle rendering)
- No API or DB changes
