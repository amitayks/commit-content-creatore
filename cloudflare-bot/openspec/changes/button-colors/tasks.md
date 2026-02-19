## 1. Infrastructure

- [x] 1.1 Add `style?: 'primary' | 'success' | 'danger'` to `InlineButton` in `src/types.ts`
- [x] 1.2 Update `src/services/telegram.ts` — in all functions that build `inline_keyboard` (sendMessage, editMessageText, sendPhoto, sendVideoMessage, sendAnimation), spread `style` into button objects when present

## 2. Home & General Views (`src/views/home.ts`)

- [x] 2.1 `renderHome` — add `style: 'primary'` to "⚡ Generate" button
- [x] 2.2 `renderCompose` — add `style: 'success'` to "✏️ Pen Down", `style: 'danger'` to "❌ Cancel" (drop ❌ emoji → "Cancel")

## 3. Drafts Views (`src/views/drafts.ts`)

- [x] 3.1 `renderDraftCategories` — add `style: 'success'` to "✅ Approved" (drop ✅ → "Approved (N)"), add `style: 'primary'` to "⚡ Generate"
- [x] 3.2 `renderDraftsList` quick actions — `style: 'success'` on approve (✅), `style: 'primary'` on publish (📤), `style: 'danger'` on delete (🗑 → drop emoji)
- [x] 3.3 `renderDraftDetail` — `style: 'success'` on "✅ Approve", `style: 'primary'` on "📤 Publish Now", `style: 'danger'` on "❌ Reject"/"❌ Cancel" (drop ❌ → "Reject"/"Cancel"), `style: 'danger'` on "🗑 Delete" (drop 🗑 → "Delete")
- [x] 3.4 `renderDeleteDraftConfirm` — `style: 'danger'` on "✅ Yes, Delete" (drop ✅ → "Yes, Delete")

## 4. Repos Views (`src/views/repos.ts`)

- [x] 4.1 `renderReposList` — `style: 'primary'` on "➕ Add repo"
- [x] 4.2 `renderRepoDetail` — toggle buttons: replace ✅/❌ emoji with `style: 'success'`/`style: 'danger'` (e.g., Tags on = green "Tags", Tags off = red "Tags"). Keep 🇺🇸/🇮🇱 flags and 🎲 as-is. `style: 'danger'` on "⏸️ Stop watching" (drop ⏸️ → "Stop watching"), `style: 'success'` on "👁 Start watching" (drop 👁 → "Start watching"), `style: 'danger'` on "🗑️ Delete" (drop 🗑️ → "Delete")
- [x] 4.3 `renderDeleteRepoConfirm` — `style: 'danger'` on "✅ Yes, delete" (drop ✅ → "Yes, delete")

## 5. Accounts Views (`src/views/accounts.ts`)

- [x] 5.1 `renderAccountsList` — `style: 'primary'` on "➕ Add account"
- [x] 5.2 `renderAccountDetail` — same toggle pattern as repos (color replaces ✅/❌). `style: 'danger'` on "⏸️ Unfollow" (drop ⏸️ → "Unfollow"), `style: 'success'` on "👁 Follow" (drop 👁 → "Follow"), `style: 'danger'` on "🗑️ Delete" (drop 🗑️ → "Delete")
- [x] 5.3 `renderDeleteAccountConfirm` — `style: 'danger'` on "✅ Yes, delete" (drop ✅ → "Yes, delete")

## 6. Settings Views (`src/views/settings.ts`)

- [x] 6.1 `renderApiKeys` — connected keys: `style: 'success'` on buttons with ✅ (drop ✅ → service name + "Update"), disconnected: default style (drop ⬜ → service name + "Connect")

## 7. Onboarding Views (`src/views/onboarding.ts`)

- [x] 7.1 `renderWelcome` — `style: 'primary'` on "🚀 Get Started" (drop 🚀 → "Get Started")
- [x] 7.2 `renderLearnMore` — `style: 'primary'` on "🚀 Get Started" (drop 🚀 → "Get Started")

## 8. Repost Views (`src/views/repost.ts`)

- [x] 8.1 `renderRepostPreview` — `style: 'primary'` on "⚡ Generate RePost"/"⚡ Generate Anyway", `style: 'danger'` on "❌ Cancel" (drop ❌ → "Cancel")

## 9. Verification

- [x] 9.1 Build check: `npx wrangler deploy --dry-run`
- [ ] 9.2 Visual spot check: verify buttons render with colors in Telegram (manual)
