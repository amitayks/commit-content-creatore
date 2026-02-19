/**
 * Settings views
 */

import type { ViewResult, InlineButton } from '../types';

export function renderSettings(timezone: string, pageSize = 5): ViewResult {
    const displayTz = timezone === 'UTC' ? 'UTC (default)' : timezone;

    return {
        text: `⚙️ <b>Settings</b>

🕐 <b>Timezone:</b> ${displayTz}
📏 <b>Page Size:</b> ${pageSize} items`,
        keyboard: [
            [{ text: '🕐 Change Timezone', callback_data: 'view:timezone_select' }],
            [{ text: '📏 Page Size', callback_data: 'view:page_size_select' }],
            [{ text: '🔑 API Keys', callback_data: 'settings:keys' }],
            [{ text: '🏠 Home', callback_data: 'view:home' }],
        ],
    };
}

export function renderPageSizeSelect(currentSize = 5): ViewResult {
    const sizes = [5, 10, 15, 20];
    const buttons: InlineButton[][] = [
        sizes.map(s => ({
            text: s === currentSize ? `[${s}]` : `${s}`,
            callback_data: `config:page_size:${s}`,
        })),
        [{ text: '◀️ Back', callback_data: 'view:settings' }],
    ];

    return {
        text: `📏 <b>Page Size</b>

Choose how many items to show per page:

Current: <b>${currentSize}</b>`,
        keyboard: buttons,
    };
}

export function renderApiKeys(services: {
    hasGemini: boolean;
    hasX: boolean;
    hasGitHub: boolean;
    hasInstagram: boolean;
}): ViewResult {
    const g = services.hasGemini;
    const x = services.hasX;
    const gh = services.hasGitHub;
    const ig = services.hasInstagram;

    return {
        text: `🔑 <b>API Keys</b>

${g ? '✅' : '⬜'} Gemini AI
${x ? '✅' : '⬜'} X/Twitter
${gh ? '✅' : '⬜'} GitHub
${ig ? '✅' : '⬜'} Instagram`,
        keyboard: [
            [{ text: `Gemini \u2014 ${g ? 'Update' : 'Connect'}`, callback_data: 'settings:update:gemini', ...(g ? { style: 'success' as const } : {}) }],
            [{ text: `X/Twitter \u2014 ${x ? 'Update' : 'Connect'}`, callback_data: 'settings:update:x', ...(x ? { style: 'success' as const } : {}) }],
            [{ text: `GitHub \u2014 ${gh ? 'Update' : 'Connect'}`, callback_data: 'settings:update:github', ...(gh ? { style: 'success' as const } : {}) }],
            [{ text: `Instagram \u2014 ${ig ? 'Update' : 'Connect'}`, callback_data: 'settings:update:instagram', ...(ig ? { style: 'success' as const } : {}) }],
            [{ text: '◀️ Back', callback_data: 'view:settings' }],
        ],
    };
}

export function renderTimezoneSelect(): ViewResult {
    const presets: InlineButton[][] = [
        [
            { text: 'UTC-5', callback_data: 'config:timezone:UTC-5' },
            { text: 'UTC-4', callback_data: 'config:timezone:UTC-4' },
            { text: 'UTC-3', callback_data: 'config:timezone:UTC-3' },
        ],
        [
            { text: 'UTC', callback_data: 'config:timezone:UTC' },
            { text: 'UTC+1', callback_data: 'config:timezone:UTC+1' },
            { text: 'UTC+2', callback_data: 'config:timezone:UTC+2' },
        ],
        [
            { text: 'UTC+3', callback_data: 'config:timezone:UTC+3' },
            { text: 'UTC+4', callback_data: 'config:timezone:UTC+4' },
            { text: 'UTC+5', callback_data: 'config:timezone:UTC+5' },
        ],
        [
            { text: 'UTC+5:30', callback_data: 'config:timezone:UTC+5:30' },
            { text: 'UTC+8', callback_data: 'config:timezone:UTC+8' },
            { text: 'UTC+9', callback_data: 'config:timezone:UTC+9' },
        ],
        [{ text: '⌨️ Type custom offset', callback_data: 'config:timezone:custom' }],
        [{ text: '◀️ Back', callback_data: 'view:settings' }],
    ];

    return {
        text: `🕐 <b>Select Timezone</b>

Choose a UTC offset or type a custom one:`,
        keyboard: presets,
    };
}
