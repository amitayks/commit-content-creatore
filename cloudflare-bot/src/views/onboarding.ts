/**
 * Onboarding Views - Step-by-step key setup for new users
 * Note: All text uses HTML formatting (Telegram parse_mode: HTML)
 */

import type { ViewResult, InlineButton } from '../types';

export function renderWelcome(): ViewResult {
    return {
        text: [
            '🎭 <b>Welcome to Muse!</b>',
            '',
            'Your AI content partner for X/Twitter.',
            '',
            "I'll help you turn your code and ideas into polished posts.",
            '',
            "First, let's connect your accounts so I can work with your APIs.",
            '',
            '<i>By continuing, you agree to provide your own API keys. Keys are encrypted and stored securely.</i>',
        ].join('\n'),
        keyboard: [
            [{ text: 'Get Started', callback_data: 'onboard:start', style: 'primary' }],
            [{ text: '❓ Learn More', callback_data: 'onboard:learn' }],
        ],
    };
}

export function renderLearnMore(): ViewResult {
    return {
        text: [
            '📖 <b>What Muse Does</b>',
            '',
            '• <b>Repost</b> — Turn any tweet into your own styled post',
            '• <b>Generate</b> — Create content from your GitHub commits',
            '• <b>Handwrite</b> — Compose tweets with AI refinement',
            '• <b>Follow</b> — Track X accounts and auto-generate reposts',
            '',
            'You bring your own API keys (Gemini for AI, X for posting).',
            'All keys are encrypted at rest and never shared.',
        ].join('\n'),
        keyboard: [
            [{ text: 'Get Started', callback_data: 'onboard:start', style: 'primary' }],
        ],
    };
}

export function renderGeminiKeyPrompt(): ViewResult {
    return {
        text: [
            '🔑 <b>Step 1/3: Google Gemini API Key</b>',
            '',
            'This powers the AI content generation.',
            '',
            'Get yours free at:',
            'aistudio.google.com/apikey',
            '',
            '📋 Paste your key below as a message:',
            '',
            '<i>(I\u2019ll delete your message immediately after saving the key)</i>',
        ].join('\n'),
        keyboard: [
            [{ text: '📖 How to get it', url: 'https://aistudio.google.com/apikey' }],
            [{ text: '⏭ Skip for now', callback_data: 'onboard:skip_gemini' }],
        ],
    };
}

export function renderGeminiSuccess(): ViewResult {
    return {
        text: '✅ <b>Gemini connected!</b>\n\nMoving to the next step...',
        keyboard: [],
    };
}

export function renderXKeysPrompt(): ViewResult {
    return {
        text: [
            '🔑 <b>Step 2/3: X/Twitter API</b>',
            '',
            'I need 4 values from developer.x.com',
            '',
            '<b>Send them in this exact format</b> (one per line):',
            '',
            '<code>API_KEY</code>',
            '<code>API_SECRET</code>',
            '<code>ACCESS_TOKEN</code>',
            '<code>ACCESS_SECRET</code>',
            '',
            '<i>(I\u2019ll delete the message immediately after saving)</i>',
        ].join('\n'),
        keyboard: [
            [{ text: '📖 How to get them', url: 'https://developer.x.com/en/portal/dashboard' }],
        ],
    };
}

export function renderXSuccess(username?: string): ViewResult {
    const label = username ? ` (@${username})` : '';
    return {
        text: `✅ <b>X/Twitter connected${label}!</b>\n\nMoving to the next step...`,
        keyboard: [],
    };
}

export function renderGitHubTokenPrompt(): ViewResult {
    return {
        text: [
            '🔑 <b>Step 3/3: GitHub Token (optional)</b>',
            '',
            'Only needed for auto-generating content from your code commits.',
            '',
            'Create a personal access token at:',
            'github.com/settings/tokens',
            '',
            '📋 Paste your token below, or skip this step.',
        ].join('\n'),
        keyboard: [
            [{ text: '📖 Create token', url: 'https://github.com/settings/tokens' }],
            [{ text: '⏭ Skip', callback_data: 'onboard:skip_github' }],
        ],
    };
}

export function renderGitHubSuccess(username?: string): ViewResult {
    const label = username ? ` (${username})` : '';
    return {
        text: `✅ <b>GitHub connected${label}!</b>`,
        keyboard: [],
    };
}

export function renderComplete(services: {
    hasGemini: boolean;
    hasX: boolean;
    hasGitHub: boolean;
    hasHeyGen: boolean;
    xUsername?: string;
}): ViewResult {
    const lines = [
        '🎉 <b>You\u2019re all set!</b>',
        '',
        '<b>Connected:</b>',
    ];

    lines.push(services.hasGemini ? '✅ Gemini AI' : '⬜ Gemini AI (skipped)');
    lines.push(services.hasX
        ? `✅ X/Twitter${services.xUsername ? ` (@${services.xUsername})` : ''}`
        : '⬜ X/Twitter (skipped)');
    lines.push(services.hasGitHub ? '✅ GitHub' : '⬜ GitHub (skipped)');
    lines.push(services.hasHeyGen ? '✅ HeyGen' : '⬜ HeyGen (skipped)');

    lines.push('');
    lines.push('Try /repost with any tweet URL, or follow an X account to get started!');

    return {
        text: lines.join('\n'),
        keyboard: [
            [{ text: '🏠 Dashboard', callback_data: 'view:home' }],
            [{ text: '⚙️ Add More Keys', callback_data: 'view:settings' }],
        ],
    };
}

export function renderKeyError(service: string, errorMessage?: string): ViewResult {
    const canSkip = service.toLowerCase() !== 'x';
    const keyboard: InlineButton[][] = [];
    if (canSkip) {
        keyboard.push([{ text: '⏭ Skip for now', callback_data: `onboard:skip_${service.toLowerCase()}` }]);
    }

    return {
        text: [
            `❌ <b>${service} key validation failed</b>`,
            '',
            errorMessage || 'The key appears to be invalid. Please check and try again.',
            '',
            canSkip ? 'Paste a new key or skip this step.' : 'Paste a new key to try again.',
        ].join('\n'),
        keyboard,
    };
}
