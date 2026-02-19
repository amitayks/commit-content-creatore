/**
 * Home & general views
 */

import type { Env, ViewResult, InlineButton, DraftContent } from '../types';
import { getNextScheduledDraft, getDraftStatusCounts, getTimezone } from '../services/db';
import { formatLocalTime } from '../services/timezone';
import { isAdmin } from '../services/security';

function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function renderHome(env: Env, chatId: string): Promise<ViewResult> {
    const [nextDraft, counts, tz] = await Promise.all([
        getNextScheduledDraft(env, chatId),
        getDraftStatusCounts(env, chatId),
        getTimezone(env, chatId),
    ]);

    const draftCount = counts['draft'] || 0;
    const approvedCount = counts['approved'] || 0;
    const scheduledCount = counts['scheduled'] || 0;

    let text: string;

    if (nextDraft) {
        const content = JSON.parse(nextDraft.content) as DraftContent;
        const firstTweet = content.tweets[0]?.text || nextDraft.pr_title;
        const preview = escapeHtml(firstTweet.length > 60 ? firstTweet.substring(0, 57) + '...' : firstTweet);
        const format = content.format === 'single' ? 'Single Tweet' : `Thread (${content.tweets.length} tweets)`;
        const timeStr = nextDraft.scheduled_at
            ? formatLocalTime(nextDraft.scheduled_at, tz)
            : 'Pending';

        text = `🤖 <b>Content Bot Dashboard</b>

📅 <b>Next up:</b>
"${preview}"
⏰ ${timeStr}
📊 ${format} | PR #${nextDraft.pr_number}

📊 <b>Queue:</b> ${scheduledCount} scheduled | ${draftCount} drafts | ${approvedCount} approved`;
    } else {
        text = `🤖 <b>Content Bot Dashboard</b>

👋 All clear! No posts in queue.

📊 ${draftCount} drafts | ${approvedCount} approved`;
    }

    const keyboard: InlineButton[][] = [];
    if (scheduledCount > 0) {
        keyboard.push([
            { text: '📅 Schedule', callback_data: 'view:drafts_scheduled' },
            { text: '📝 Drafts', callback_data: 'view:drafts' },
        ]);
    } else {
        keyboard.push([{ text: '📝 Drafts', callback_data: 'view:drafts' }]);
    }
    keyboard.push([
        { text: '✍️ Handwrite', callback_data: 'view:handwrite', style: 'primary' },
        { text: '⚡ Generate', callback_data: 'view:generate', style: 'primary' },
        { text: '🔄 RePost', callback_data: 'view:repost', style: 'primary' },
    ]);
    keyboard.push([
        { text: '📦 Repos', callback_data: 'view:repos' },
        { text: '👤 Accounts', callback_data: 'view:accounts' },
    ]);
    if (isAdmin(chatId, env)) {
        keyboard.push([{ text: '🎬 Video Studio', callback_data: 'view:video_studio' }]);
    }
    keyboard.push([
        { text: '⚙️ Settings', callback_data: 'view:settings' },
        { text: '❓ Help', callback_data: 'view:help' },
    ]);

    return { text, keyboard };
}

export function renderHelp(): ViewResult {
    return {
        text: `❓ <b>Help</b>

<b>Create Content</b>
⚡ <b>Generate</b> — AI creates a post from any commit or PR
✍️ <b>Handwrite</b> — Compose your own tweet or thread
🔄 <b>RePost</b> — Quote-tweet from any tweet URL

<b>Manage</b>
📝 <b>Drafts</b> — Review, edit, approve, schedule, or delete
📦 <b>Repos</b> — Watch repos for auto-generated content
👤 <b>Accounts</b> — Follow X accounts for repost suggestions

<b>How it works</b>
Watch a repo → new PRs auto-generate drafts → review and publish to X. Scheduled posts go out automatically. AI images are generated and attached when publishing.

<b>Quick commands</b>
/generate, /handwrite, /repost, /drafts, /repos, /watch, /help`,
        keyboard: [[{ text: '🏠 Home', callback_data: 'view:home' }]],
    };
}

export function renderError(message: string): ViewResult {
    return {
        text: `❌ <b>Error</b>

${message}

Tap Home to return to the dashboard.`,
        keyboard: [[{ text: '🏠 Home', callback_data: 'view:home' }]],
    };
}

export function renderSuccess(message: string): ViewResult {
    return {
        text: `✅ <b>Success!</b>

${message}`,
        keyboard: [[{ text: '🏠 Home', callback_data: 'view:home' }]],
    };
}

export function renderGenerating(sha: string): ViewResult {
    return {
        text: `🔄 <b>Generating...</b>

Finding PR for commit <code>${sha}</code>...

This may take a moment.`,
        keyboard: [],
    };
}

export function renderPublishing(count: number): ViewResult {
    return {
        text: `📤 <b>Publishing...</b>

Publishing ${count} draft${count > 1 ? 's' : ''} to X...

Please wait.`,
        keyboard: [],
    };
}

export interface ComposeTweet {
    text: string;
    hasMedia?: boolean;
}

export function renderCompose(tweets: ComposeTweet[], charWarnings: number[], imageGen: boolean, aiRefine: boolean): ViewResult {
    const count = tweets.length;

    let text: string;

    if (count === 0) {
        text = `✍️ <b>Compose Your Post</b>

Send me your content — each message becomes a tweet in the thread.

📝 <b>Text</b> — just type and send
📷 <b>Photo</b> — attach an image (with optional caption)
✏️ <b>Edit</b> — edit any sent message to update it

When you're done, tap <b>Pen Down</b> to save your draft.

🎨 <b>Image</b> — AI generates an eye-catching image for your post
✨ <b>AI Refine</b> — polishes your writing while keeping your voice`;
    } else {
        const format = count === 1 ? 'Single Tweet' : `Thread · ${count} tweets`;
        text = `✍️ <b>Composing</b> — ${format}\n`;

        for (let i = 0; i < tweets.length; i++) {
            const t = tweets[i];
            const media = t.hasMedia ? ' 📷' : '';
            const len = t.text.length;
            const over = len > 280;
            const preview = t.text.length > 80 ? t.text.substring(0, 77) + '...' : t.text;
            const safePreview = escapeHtml(preview);
            text += `\n${i + 1}. ${safePreview}${media}`;
            text += `\n    <i>${len}/280${over ? ' ⚠️' : ''}</i>`;
        }
    }

    if (charWarnings.length > 0) {
        const warnings = charWarnings.map(i => `Tweet ${i}`).join(', ');
        text += `\n\n⚠️ ${warnings} exceed${charWarnings.length === 1 ? 's' : ''} 280 chars — will be trimmed on publish`;
    }

    return {
        text,
        keyboard: [
            [{ text: '✏️ Pen Down', callback_data: 'compose:pendown', style: 'success' }],
            [
                { text: `🎨 Image: ${imageGen ? 'ON' : 'OFF'}`, callback_data: 'compose:toggle_image' },
                { text: `✨ AI: ${aiRefine ? 'ON' : 'OFF'}`, callback_data: 'compose:toggle_ai' },
            ],
            [{ text: 'Cancel', callback_data: 'compose:cancel', style: 'danger' }],
        ],
    };
}
