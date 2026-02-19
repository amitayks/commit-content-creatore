## Context

The bot uses Telegram inline keyboard buttons across 9 view files. Currently, all visual meaning is conveyed via Unicode emojis in button text. Telegram Bot API 9.4 (Feb 2026) added a `style` field to `InlineKeyboardButton` with three values: `"primary"` (blue), `"success"` (green), `"danger"` (red). Default is the standard gray button.

Current `InlineButton` type:
```ts
export interface InlineButton {
    text: string;
    callback_data?: string;
    url?: string;
}
```

Current keyboard serialization in `telegram.ts` passes buttons directly to `inline_keyboard` in `reply_markup`.

## Goals / Non-Goals

**Goals:**
- Add `style` support to `InlineButton` type and Telegram API calls
- Apply consistent color scheme: green=approve/on, blue=primary CTA, red=destructive/off
- Remove redundant emojis where color alone conveys intent
- Keep emojis where they provide categorical meaning beyond color

**Non-Goals:**
- Custom emoji icons via `icon_custom_emoji_id` (requires premium/custom emoji setup)
- Changing button layout or adding/removing buttons
- Changing any callback_data values or routing logic

## Decisions

**Decision 1: Style field on InlineButton**
Add optional `style?: 'primary' | 'success' | 'danger'` to `InlineButton`. When omitted, Telegram uses its default gray.

**Decision 2: Keyboard serialization**
In `telegram.ts`, when building `inline_keyboard` arrays, spread `style` into each button object only when defined. This ensures backward compatibility — buttons without style work exactly as before.

**Decision 3: Emoji removal rules**
- Remove emoji when color fully replaces its meaning: `✅`/`❌` toggles, `🗑️` delete, `❌` cancel/reject
- Keep emoji when it adds identity beyond color: `📦` Repos, `⚡` Generate, `📤` Publish, `🏠` Home, flag emojis, tone emojis
- Keep emoji + add color when both add value: `✅ Approve` with green, `📤 Publish Now` with blue

## Risks / Trade-offs

- [Older Telegram clients may ignore `style`] → Graceful degradation — buttons still work, just no color. Emoji text remains readable.
- [No "warning/yellow" style available] → Use default gray for neutral actions, which is fine since yellow warning is rare in our UI.
