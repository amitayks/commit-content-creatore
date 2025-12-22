/**
 * View renderers for the interactive dashboard.
 */

import type { Env } from '../index';
import type { Draft } from '../services/database';
import { getStats, getDraftsByStatus, getDraft } from '../services/database';
import type { InlineButton } from '../services/telegram';

/**
 * Render the home/welcome view.
 */
export async function renderHome(env: Env): Promise<{ text: string; keyboard: InlineButton[][] }> {
    const stats = await getStats(env);

    const text = `👋 <b>Welcome to Content Tracker!</b>

I turn your GitHub commits into engaging X (Twitter) threads automatically.

📝 <b>Pending:</b> ${stats.pending} drafts ready for review
✅ <b>Approved:</b> ${stats.approved} waiting to publish
🚀 <b>Published today:</b> ${stats.publishedToday}

<i>Tap a button to navigate</i>`;

    const keyboard: InlineButton[][] = [
        [
            { text: '📋 View Drafts', callback_data: 'view:drafts' },
            { text: '📊 Stats', callback_data: 'view:stats' },
        ],
        [
            { text: '🔄 Generate', callback_data: 'view:generate' },
            { text: '❓ Help', callback_data: 'view:help' },
        ],
    ];

    return { text, keyboard };
}

/**
 * Render the drafts list view.
 */
export async function renderDraftsList(env: Env): Promise<{ text: string; keyboard: InlineButton[][] }> {
    const drafts = await getDraftsByStatus(env, 'draft');

    if (drafts.length === 0) {
        return {
            text: `📋 <b>Pending Drafts</b>\n\n📭 No pending drafts.\n\nNew drafts are created when you push code or merge PRs.`,
            keyboard: [
                [{ text: '🔄 Generate New', callback_data: 'view:generate' }],
                [{ text: '◀️ Back', callback_data: 'view:home' }],
            ],
        };
    }

    const lines = [`📋 <b>Pending Drafts (${drafts.length})</b>\n`];

    drafts.slice(0, 5).forEach((draft, i) => {
        const content = JSON.parse(draft.content);
        const preview = content.tweets?.[0]?.text?.slice(0, 50) || 'No preview';
        lines.push(`${i + 1}. <b>${draft.project_id}</b>`);
        lines.push(`   "${preview}..." (${content.tweets?.length || 0} tweets)`);
        lines.push(``);
    });

    // Build view buttons for each draft
    const draftButtons: InlineButton[][] = drafts.slice(0, 5).map((draft, i) => [
        { text: `👁️ View #${i + 1}`, callback_data: `draft:${draft.id}` },
    ]);

    return {
        text: lines.join('\n'),
        keyboard: [
            ...draftButtons,
            [{ text: '◀️ Back', callback_data: 'view:home' }],
        ],
    };
}

/**
 * Render a single draft view.
 */
export async function renderDraft(env: Env, draftId: string): Promise<{ text: string; keyboard: InlineButton[][] }> {
    const draft = await getDraft(env, draftId);

    if (!draft) {
        return {
            text: `❌ Draft not found`,
            keyboard: [[{ text: '◀️ Back', callback_data: 'view:drafts' }]],
        };
    }

    const content = JSON.parse(draft.content);
    const source = JSON.parse(draft.source);

    const lines = [
        `📝 <b>Draft Preview</b>`,
        ``,
        `📦 <b>Project:</b> ${draft.project_id}`,
        `🔗 <a href="${source.url}">View on GitHub</a>`,
        `📊 <b>Format:</b> ${content.format === 'thread' ? `Thread (${content.tweets?.length} tweets)` : 'Single Tweet'}`,
        ``,
        `━━━━━━━━━━━━━━━━━━━━━━`,
    ];

    content.tweets?.forEach((tweet: { text: string }, i: number) => {
        if (content.tweets.length > 1) {
            lines.push(`\n<b>[${i + 1}/${content.tweets.length}]</b>`);
        }
        lines.push(escapeHtml(tweet.text));
        lines.push(`<i>(${tweet.text.length}/280)</i>`);
    });

    lines.push(`━━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`\n<b>Status:</b> ${draft.status.toUpperCase()}`);

    const keyboard: InlineButton[][] = draft.status === 'draft' ? [
        [
            { text: '✅ Approve', callback_data: `action:approve:${draftId}` },
            { text: '❌ Reject', callback_data: `action:reject:${draftId}` },
        ],
        [
            { text: '🔄 Regenerate', callback_data: `action:regenerate:${draftId}` },
        ],
        [{ text: '◀️ Back to List', callback_data: 'view:drafts' }],
    ] : [
        [{ text: '◀️ Back to List', callback_data: 'view:drafts' }],
    ];

    return { text: lines.join('\n'), keyboard };
}

/**
 * Render stats view.
 */
export async function renderStats(env: Env): Promise<{ text: string; keyboard: InlineButton[][] }> {
    const stats = await getStats(env);

    const text = `📊 <b>Content Statistics</b>

📝 Pending drafts: ${stats.pending}
✅ Approved (queued): ${stats.approved}
🚀 Total published: ${stats.published}
❌ Rejected: ${stats.rejected}

📅 Published today: ${stats.publishedToday}`;

    return {
        text,
        keyboard: [[{ text: '◀️ Back', callback_data: 'view:home' }]],
    };
}

/**
 * Render help view.
 */
export function renderHelp(): { text: string; keyboard: InlineButton[][] } {
    const text = `❓ <b>Help</b>

<b>How it works:</b>
1. Push code or merge a PR to GitHub
2. AI generates an X thread about your changes
3. Review and approve the draft here
4. Use /publish or wait for auto-publish

<b>Navigation:</b>
• Use buttons to navigate views
• Send any message to show the dashboard

<b>Actions:</b>
• ✅ Approve - Queue draft for publishing
• ❌ Reject - Discard draft
• 🔄 Regenerate - Create new version`;

    return {
        text,
        keyboard: [[{ text: '◀️ Back', callback_data: 'view:home' }]],
    };
}

/**
 * Render generate view (input prompt).
 */
export function renderGenerate(): { text: string; keyboard: InlineButton[][] } {
    const text = `🔄 <b>Generate Content</b>

Enter a commit SHA to generate content for:

<i>Example: Reply with a commit hash like</i>
<code>2b5819b</code>

Or use the full SHA from GitHub.`;

    return {
        text,
        keyboard: [[{ text: '◀️ Cancel', callback_data: 'view:home' }]],
    };
}

/**
 * Escape HTML special characters.
 */
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
