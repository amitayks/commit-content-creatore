/**
 * Repost views — prompt, preview with tone selector, generating
 */

import type { ViewResult, InlineButton, TwitterAccountConfig } from '../types';

function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const TONE_LABELS: Record<string, string> = {
    professional: '💼 Pro',
    casual: '😎 Casual',
    analytical: '🔬 Analytical',
    enthusiastic: '🔥 Enthus',
    witty: '🧠 Witty',
    sarcastic: '😏 Sarcastic',
};

export function renderRepostPrompt(): ViewResult {
    return {
        text: `🔄 <b>Manual RePost</b>

Send me a tweet URL to create a repost.

<b>Supported formats:</b>
<code>https://x.com/username/status/123456</code>
<code>https://twitter.com/username/status/123456</code>

I'll fetch the tweet, show you a preview, and let you choose a tone before generating.`,
        keyboard: [[{ text: '❌ Cancel', callback_data: 'view:home' }]],
    };
}

export function renderRepostPreview(params: {
    tweetId: string;
    username: string;
    displayName?: string | null;
    tweetText: string;
    isThread: boolean;
    threadCount?: number;
    metrics?: { likes: number; retweets: number; quotes: number; replies: number };
    selectedTone: TwitterAccountConfig['tone'];
    existingDraftId?: string | null;
    hasImage?: boolean;
}): ViewResult {
    const { tweetId, username, displayName, tweetText, isThread, threadCount, metrics, selectedTone, existingDraftId, hasImage } = params;

    const nameDisplay = displayName ? `${displayName} (@${username})` : `@${username}`;
    const preview = tweetText.length > 200 ? tweetText.substring(0, 197) + '...' : tweetText;
    const imageLabel = hasImage ? '\n🖼 Has image — will be analyzed by AI' : '';
    const threadLabel = isThread ? `\n📎 Thread (${threadCount || '?'} tweets)` : '';

    let metricsLine = '';
    if (metrics) {
        metricsLine = `\n❤️ ${formatNum(metrics.likes)} · 🔄 ${formatNum(metrics.retweets)} · 💬 ${formatNum(metrics.replies)} · 🔗 ${formatNum(metrics.quotes)}`;
    }

    let text = `🔄 <b>RePost Preview</b>

<b>${escapeHtml(nameDisplay)}</b>${threadLabel}${imageLabel}${metricsLine}

${escapeHtml(preview)}

<b>Tone:</b> ${TONE_LABELS[selectedTone] || selectedTone}
Tap a tone below, then Generate:`;

    // Build keyboard
    const keyboard: InlineButton[][] = [];

    // Tone selector row (split into 2 rows of 3)
    const tones = Object.entries(TONE_LABELS);
    const toneRow1: InlineButton[] = [];
    const toneRow2: InlineButton[] = [];

    for (let i = 0; i < tones.length; i++) {
        const [key, label] = tones[i];
        const isSelected = key === selectedTone;
        const btn: InlineButton = {
            text: isSelected ? `[${label}]` : label,
            callback_data: `rp_tone:${key}:${tweetId}`,
        };
        if (i < 3) toneRow1.push(btn);
        else toneRow2.push(btn);
    }
    keyboard.push(toneRow1, toneRow2);

    // Duplicate warning + generate
    if (existingDraftId) {
        text = `⚠️ <b>Duplicate Detected</b>\n\nYou already have a repost draft for this tweet.\n\n` + text;
        keyboard.push([
            { text: '👁 View Existing', callback_data: `tw_view:${existingDraftId}` },
            { text: '⚡ Generate Anyway', callback_data: `rp_gen_anyway:${tweetId}`, style: 'primary' },
        ]);
    } else {
        keyboard.push([{ text: '⚡ Generate RePost', callback_data: `rp_gen:${tweetId}`, style: 'primary' }]);
    }

    keyboard.push([
        { text: '🔗 Open Tweet', url: `https://x.com/${username}/status/${tweetId}` },
        { text: 'Cancel', callback_data: 'rp_cancel:0', style: 'danger' },
    ]);

    return { text, keyboard };
}

export function renderRepostGenerating(username: string): ViewResult {
    return {
        text: `⏳ <b>Generating repost for @${username}...</b>

Fetching context and creating your quote tweet.`,
        keyboard: [],
    };
}

function formatNum(n: number): string {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
}
