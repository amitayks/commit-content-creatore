/**
 * Video Settings views — Characters, Looks, Voices, Defaults, HeyGen Account, Instagram
 */

import type { ViewResult, InlineButton, HeyGenCharacter, VideoSettings } from '../types';

function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Video settings home — subsection buttons
 */
export function renderVideoSettingsHome(settings: VideoSettings): ViewResult {
    const charCount = settings.characters.length;

    return {
        text: `🎬 <b>Video Settings</b>\n\n` +
            `👤 Characters: ${charCount} configured\n` +
            `🎙️ Voices: Configure per character\n` +
            `⚙️ Defaults: Pre-populate new video configs`,
        keyboard: [
            [{ text: `👤 Characters (${charCount})`, callback_data: 'vsettings:characters' }],
            [{ text: '⚙️ Defaults', callback_data: 'vsettings:defaults' }],
            [{ text: '🔑 HeyGen Account', callback_data: 'vsettings:heygen' }],
            [{ text: '📸 Instagram', callback_data: 'vsettings:instagram' }],
            [{ text: '◀️ Video Studio', callback_data: 'view:video_studio' }],
        ],
    };
}

/**
 * Character listing view
 */
export function renderCharacterList(settings: VideoSettings): ViewResult {
    const chars = settings.characters;

    if (chars.length === 0) {
        return {
            text: `👤 <b>Characters</b>\n\nNo characters configured yet.\n\nAdd a character to start creating videos with Photo Avatars.`,
            keyboard: [
                [{ text: '➕ Add Character', callback_data: 'vsettings:add_character' }],
                [{ text: '◀️ Video Settings', callback_data: 'vsettings:home' }],
            ],
        };
    }

    const statusIcon = (s: string) => s === 'ready' ? '✅' : s === 'training' ? '⏳' : '❌';

    let text = `👤 <b>Characters</b>\n`;
    for (const c of chars) {
        const looksCount = (c.looks || []).length;
        text += `\n${statusIcon(c.status)} <b>${escapeHtml(c.name)}</b>`;
        text += ` — ${looksCount} look${looksCount !== 1 ? 's' : ''}`;
        if (c.voiceId) text += ' 🎙️';
        if (c.personality) text += `\n    <i>${escapeHtml(c.personality.substring(0, 60))}</i>`;
    }

    const buttons: InlineButton[][] = [];
    for (const c of chars) {
        buttons.push([
            { text: `👁️ ${c.name}`, callback_data: `vsettings:char_detail:${c.heygenGroupId}` },
        ]);
    }
    buttons.push([{ text: '➕ Add Character', callback_data: 'vsettings:add_character' }]);
    buttons.push([{ text: '◀️ Video Settings', callback_data: 'vsettings:home' }]);

    return { text, keyboard: buttons };
}

/**
 * Character detail view — shows looks with pagination, edit, remove options
 */
export function renderCharacterDetail(character: HeyGenCharacter, lookPage = 0): ViewResult {
    const statusIcon = character.status === 'ready' ? '✅' : character.status === 'training' ? '⏳' : '❌';
    const statusLabel = character.status === 'ready' ? 'Ready' : character.status === 'training' ? 'Training...' : 'Failed';
    const looks = character.looks || [];

    const LOOKS_PAGE_SIZE = 5;
    const totalLookPages = Math.max(1, Math.ceil(looks.length / LOOKS_PAGE_SIZE));
    const safePage = Math.min(lookPage, totalLookPages - 1);
    const lookStart = safePage * LOOKS_PAGE_SIZE;
    const shownLooks = looks.slice(lookStart, lookStart + LOOKS_PAGE_SIZE);

    let text = `${statusIcon} <b>${escapeHtml(character.name)}</b>\n\n`;
    text += `📊 Status: ${statusLabel}\n`;
    text += `🎙️ Voice: ${character.voiceId || 'Not set'}\n`;
    text += `😊 Emotion: ${character.defaultEmotion || 'Friendly'}\n`;
    if (character.personality) text += `📝 Personality: <i>${escapeHtml(character.personality.substring(0, 100))}</i>\n`;

    if (looks.length > 0) {
        text += `\n🎭 <b>Looks (${looks.length}):</b>`;
        if (totalLookPages > 1) {
            text += ` <i>page ${safePage + 1}/${totalLookPages}</i>`;
        }
        for (let i = 0; i < shownLooks.length; i++) {
            const hasKey = shownLooks[i].imageKey ? '🔑' : '⚠️';
            text += `\n  ${hasKey} ${lookStart + i + 1}. ${escapeHtml(shownLooks[i].name)}`;
        }
    } else {
        text += `\n🎭 <b>Looks:</b> None yet`;
        if (character.status !== 'training') {
            text += `\n<i>Upload photos to add looks.</i>`;
        }
    }

    const keyboard: InlineButton[][] = [];

    // Primary actions row — short `vs:` prefix, groupId stored in context
    keyboard.push([
        { text: '🎙️ Voice', callback_data: 'vs:voice' },
        { text: '✏️ Personality', callback_data: 'vs:edit_char' },
    ]);

    // Training & sync — contextual buttons based on status
    if (character.status === 'training') {
        keyboard.push([
            { text: '⏳ Check Training...', callback_data: 'vs:train_char' },
            { text: '🔄 Sync Looks', callback_data: 'vs:sync_looks' },
        ]);
    } else if (character.status === 'ready') {
        keyboard.push([
            { text: '🔄 Sync Looks', callback_data: 'vs:sync_looks' },
            { text: '🧠 Re-Train', callback_data: 'vs:train_char' },
        ]);
    } else {
        keyboard.push([{ text: '🧠 Train Avatar', callback_data: 'vs:train_char' }]);
    }

    // Look management (only when trained)
    if (character.status === 'ready') {
        keyboard.push([{ text: '➕ Add Look', callback_data: 'vs:add_look' }]);

        // Remove buttons for looks on current page
        for (let i = 0; i < shownLooks.length; i++) {
            const absIndex = lookStart + i;
            const lookName = shownLooks[i].name.length > 20
                ? shownLooks[i].name.substring(0, 18) + '..'
                : shownLooks[i].name;
            keyboard.push([
                { text: `🗑️ Remove "${lookName}"`, callback_data: `vs:rl:${absIndex}` },
            ]);
        }

        // Look pagination
        if (totalLookPages > 1) {
            const nav: InlineButton[] = [];
            if (safePage > 0) nav.push({ text: '◀️ Prev', callback_data: `vs:lp:${safePage - 1}` });
            if (safePage < totalLookPages - 1) nav.push({ text: 'Next ▶️', callback_data: `vs:lp:${safePage + 1}` });
            keyboard.push(nav);
        }
    }

    // Danger zone + nav
    keyboard.push([{ text: '🗑️ Remove Character', callback_data: 'vs:remove_char' }]);
    keyboard.push([{ text: '◀️ Characters', callback_data: 'vs:characters' }]);

    return { text, keyboard };
}

/**
 * Character removal confirmation
 */
export function renderRemoveCharacterConfirm(character: HeyGenCharacter): ViewResult {
    return {
        text: `⚠️ <b>Remove Character?</b>\n\n` +
            `"${escapeHtml(character.name)}" will be removed from your local configuration.\n\n` +
            `Note: The avatar group on HeyGen will NOT be deleted. You can manage it in the HeyGen dashboard.\n` +
            `Existing video drafts using this character will not be affected.`,
        keyboard: [
            [{ text: '🗑️ Yes, Remove', callback_data: `vsettings:confirm_remove_char:${character.heygenGroupId}` }],
            [{ text: '❌ Cancel', callback_data: `vsettings:char_detail:${character.heygenGroupId}` }],
        ],
    };
}

/**
 * Voice selection view — uses numeric indices to keep callback_data under 64 bytes
 * The voice list is stored in context so the handler can look up by index.
 */
export function renderVoiceSelect(
    character: HeyGenCharacter,
    voices: Array<{ voice_id: string; name: string; language?: string; gender?: string }>,
    page = 0
): ViewResult {
    const PAGE_SIZE = 8;
    const start = page * PAGE_SIZE;
    const shown = voices.slice(start, start + PAGE_SIZE);
    const totalPages = Math.ceil(voices.length / PAGE_SIZE);

    const currentName = character.voiceId
        ? voices.find(v => v.voice_id === character.voiceId)?.name || character.voiceId.substring(0, 12)
        : 'Not set';

    let text = `🎙️ <b>Select Voice for ${escapeHtml(character.name)}</b>\n\n`;
    text += `Current: ${escapeHtml(currentName)}\n`;
    text += `Showing ${start + 1}–${start + shown.length} of ${voices.length}`;

    const keyboard: InlineButton[][] = [];
    for (let i = 0; i < shown.length; i++) {
        const v = shown[i];
        const label = `${v.name}${v.gender ? ` (${v.gender})` : ''}${v.language ? ` [${v.language}]` : ''}`;
        const selected = v.voice_id === character.voiceId;
        keyboard.push([{
            text: selected ? `✅ ${label}` : label,
            callback_data: `vsettings:sv:${start + i}`,
        }]);
    }

    // Pagination
    if (totalPages > 1) {
        const nav: InlineButton[] = [];
        if (page > 0) nav.push({ text: '◀️ Prev', callback_data: `vsettings:vp:${page - 1}` });
        if (page < totalPages - 1) nav.push({ text: 'Next ▶️', callback_data: `vsettings:vp:${page + 1}` });
        keyboard.push(nav);
    }

    keyboard.push([{ text: '◀️ Back', callback_data: `vsettings:char_detail:${character.heygenGroupId}` }]);

    return { text, keyboard };
}

/**
 * Emotion selector for character
 */
export function renderEmotionSelect(character: HeyGenCharacter): ViewResult {
    const emotions = ['Excited', 'Friendly', 'Serious', 'Soothing', 'Broadcaster'];

    return {
        text: `😊 <b>Default Emotion for ${escapeHtml(character.name)}</b>\n\nSelect the default emotion for video scenes:`,
        keyboard: [
            ...emotions.map(e => [{
                text: e === character.defaultEmotion ? `✅ ${e}` : e,
                callback_data: `vs:set_emotion:${e}`,
            }]),
            [{ text: '◀️ Back', callback_data: `vsettings:char_detail:${character.heygenGroupId}` }],
        ],
    };
}

/**
 * Default video settings view
 */
export function renderDefaultSettings(settings: VideoSettings): ViewResult {
    const d = settings.defaults;

    return {
        text: `⚙️ <b>Default Video Settings</b>\n\n` +
            `These values pre-populate new video configurations:\n\n` +
            `📐 Aspect Ratio: ${d.aspectRatio || '16:9'}\n` +
            `⏱️ Max Length: ${d.maxLength || 'No limit'}\n` +
            `👤 Character: ${d.defaultCharacterId ? settings.characters.find(c => c.heygenGroupId === d.defaultCharacterId)?.name || d.defaultCharacterId : 'None'}\n` +
            `🎨 Background: ${d.defaultBackground || '#ffffff'}\n` +
            `📝 Captions: ${d.defaultCaptions !== undefined ? (d.defaultCaptions ? 'ON' : 'OFF') : 'OFF'}`,
        keyboard: [
            [
                { text: '📐 Aspect Ratio', callback_data: 'vsettings:def_aspect' },
                { text: '⏱️ Max Length', callback_data: 'vsettings:def_length' },
            ],
            [{ text: '👤 Character', callback_data: 'vsettings:def_character' }],
            [
                { text: '🎨 Background', callback_data: 'vsettings:def_bg' },
                { text: `📝 Captions: ${d.defaultCaptions ? 'ON' : 'OFF'}`, callback_data: 'vsettings:def_captions_toggle' },
            ],
            [{ text: '◀️ Video Settings', callback_data: 'vsettings:home' }],
        ],
    };
}

/**
 * HeyGen account settings view
 */
export function renderHeyGenSettings(hasApiKey: boolean): ViewResult {
    return {
        text: `🔑 <b>HeyGen Account</b>\n\n` +
            `API Key: ${hasApiKey ? '✅ Configured' : '❌ Not configured'}\n\n` +
            `<b>Credit Costs:</b>\n` +
            `• Avatar III: 1 credit per minute of video\n` +
            `• Avatar IV: 6 credits per minute of video\n` +
            `• Photo Avatar training: 4 credits per look`,
        keyboard: [
            [{ text: '◀️ Video Settings', callback_data: 'vsettings:home' }],
        ],
    };
}

/**
 * Instagram settings view
 */
export function renderInstagramSettings(hasCredentials: boolean): ViewResult {
    return {
        text: `📸 <b>Instagram Settings</b>\n\n` +
            `Business Account ID: ${hasCredentials ? '✅ Configured' : '❌ Not configured'}\n` +
            `Access Token: ${hasCredentials ? '✅ Configured' : '❌ Not configured'}\n\n` +
            (hasCredentials
                ? 'Instagram Reels publishing is enabled.'
                : 'Configure your Instagram Business Account credentials to enable Reels publishing.'),
        keyboard: [
            [{ text: '◀️ Video Settings', callback_data: 'vsettings:home' }],
        ],
    };
}
