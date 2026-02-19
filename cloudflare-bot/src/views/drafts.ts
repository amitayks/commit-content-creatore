/**
 * Draft-related views
 */

import type { Env, ViewResult, Draft, DraftContent, InlineButton } from '../types';
import { getAllDrafts, countDrafts, getDraft, getPublishedByDraft, getHandwriteDraftCount, getDraftsBySource, countDraftsBySource } from '../services/db';
import { formatLocalTime } from '../services/timezone';

function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Safely truncate HTML text to a max length without breaking tags.
 * Strips all open tags that would be left unclosed after truncation.
 */
export function truncateHtml(html: string, maxLen: number): string {
    if (html.length <= maxLen) return html;

    // Truncate to maxLen - 3 to leave room for "..."
    let truncated = html.substring(0, maxLen - 3);

    // If we cut inside a tag (after < but before >), back up to before the <
    const lastOpen = truncated.lastIndexOf('<');
    const lastClose = truncated.lastIndexOf('>');
    if (lastOpen > lastClose) {
        truncated = truncated.substring(0, lastOpen);
    }

    // Close any unclosed tags
    const openTags: string[] = [];
    const tagRegex = /<\/?([a-zA-Z]+)[^>]*>/g;
    let match;
    while ((match = tagRegex.exec(truncated)) !== null) {
        const isClosing = match[0][1] === '/';
        const tagName = match[1].toLowerCase();
        if (isClosing) {
            const idx = openTags.lastIndexOf(tagName);
            if (idx !== -1) openTags.splice(idx, 1);
        } else {
            openTags.push(tagName);
        }
    }

    // Close tags in reverse order
    let result = truncated + '...';
    for (let i = openTags.length - 1; i >= 0; i--) {
        result += `</${openTags[i]}>`;
    }
    return result;
}

export type DraftListType = 'auto' | 'approved' | 'scheduled' | 'handwrite' | 'published' | 'repost';

// Short codes for callback_data (Telegram 64-byte limit)
const listTypeToShort: Record<string, string> = { auto: 'a', handwrite: 'h', approved: 'v', scheduled: 's', published: 'p', repost: 'r' };
export const shortToListType: Record<string, DraftListType> = { a: 'auto', h: 'handwrite', v: 'approved', s: 'scheduled', p: 'published', r: 'repost' };

const statusEmoji: Record<string, string> = {
    draft: '📝',
    approved: '✅',
    scheduled: '📅',
    published: '📤',
};

export async function renderDraftCategories(env: Env, chatId: string): Promise<ViewResult> {
    const [autoCount, handwriteCount, repostCount, approvedCount, scheduledCount, publishedCount] = await Promise.all([
        countDraftsForType(env, chatId, 'auto'),
        getHandwriteDraftCount(env, chatId),
        countDraftsBySource(env, chatId, 'repost', ['draft']),
        countDrafts(env, chatId, 'approved'),
        countDrafts(env, chatId, 'scheduled'),
        countDrafts(env, chatId, 'published'),
    ]);

    const total = autoCount + handwriteCount + repostCount + approvedCount + scheduledCount + publishedCount;

    if (total === 0) {
        return {
            text: `📝 <b>Drafts</b>

No drafts yet. Use ⚡ Generate or ✍️ Handwrite to create one!`,
            keyboard: [
                [{ text: '⚡ Generate', callback_data: 'view:generate', style: 'primary' }],
                [{ text: '✍️ Handwrite', callback_data: 'view:handwrite' }],
                [{ text: '🏠 Home', callback_data: 'view:home' }],
            ],
        };
    }

    return {
        text: `📝 <b>Drafts</b> (${total} total)

Select a category:`,
        keyboard: [
            [{ text: `📤 Auto-generated (${autoCount})`, callback_data: 'view:drafts_auto' }],
            [{ text: `✍️ Handwritten (${handwriteCount})`, callback_data: 'view:drafts_handwrite' }],
            [{ text: `🔄 RePosts (${repostCount})`, callback_data: 'view:drafts_repost' }],
            [{ text: `Approved (${approvedCount})`, callback_data: 'view:drafts_approved', style: 'success' }],
            [{ text: `📅 Scheduled (${scheduledCount})`, callback_data: 'view:drafts_scheduled' }],
            [{ text: `🗂 Published (${publishedCount})`, callback_data: 'view:drafts_published' }],
            [{ text: '🏠 Home', callback_data: 'view:home' }],
        ],
    };
}

async function countDraftsForType(env: Env, chatId: string, type: DraftListType): Promise<number> {
    if (type === 'auto') {
        return countDraftsBySource(env, chatId, 'auto', ['draft']);
    }
    if (type === 'approved') return countDrafts(env, chatId, 'approved');
    if (type === 'scheduled') return countDrafts(env, chatId, 'scheduled');
    return 0;
}

export async function renderDraftsList(env: Env, chatId: string, page = 0, listType: DraftListType = 'auto', pageSize = 5): Promise<ViewResult> {
    const limit = pageSize;
    const offset = page * limit;

    let drafts: Draft[];
    let total: number;

    if (listType === 'auto') {
        [drafts, total] = await Promise.all([
            getDraftsBySource(env, chatId, 'auto', ['draft'], limit, offset),
            countDraftsBySource(env, chatId, 'auto', ['draft']),
        ]);
    } else if (listType === 'approved') {
        drafts = await getAllDrafts(env, chatId, 'approved', limit, offset);
        total = await countDrafts(env, chatId, 'approved');
    } else if (listType === 'handwrite') {
        drafts = await getDraftsBySource(env, chatId, 'handwrite', ['draft'], limit, offset);
        total = await countDraftsBySource(env, chatId, 'handwrite', ['draft']);
    } else if (listType === 'repost') {
        drafts = await getDraftsBySource(env, chatId, 'repost', ['draft'], limit, offset);
        total = await countDraftsBySource(env, chatId, 'repost', ['draft']);
    } else if (listType === 'published') {
        drafts = await getAllDrafts(env, chatId, 'published', limit, offset);
        total = await countDrafts(env, chatId, 'published');
    } else {
        drafts = await getAllDrafts(env, chatId, 'scheduled', limit, offset);
        total = await countDrafts(env, chatId, 'scheduled');
    }

    const totalPages = Math.ceil(total / limit);
    const typeLabels: Record<string, string> = { auto: 'Auto-generated', approved: 'Approved', handwrite: 'Handwritten', scheduled: 'Scheduled', published: 'Published', repost: 'RePosts' };
    const typeLabel = typeLabels[listType] || listType;

    if (drafts.length === 0) {
        return {
            text: `📝 <b>${typeLabel} Drafts</b>

No ${typeLabel.toLowerCase()} drafts found.`,
            keyboard: [
                [{ text: '◀️ Back', callback_data: 'view:drafts' }, { text: '🏠 Home', callback_data: 'view:home' }],
            ],
        };
    }

    // Build display title for each draft
    function getDraftDisplayTitle(d: typeof drafts[0]): string {
        if (d.source === 'auto' && d.pr_title.includes(' | ')) {
            // New format: "repoName | originalTitle" — show repo + first tweet text
            const repo = d.pr_title.split(' | ')[0].substring(0, 10);
            try {
                const content = JSON.parse(d.content) as DraftContent;
                const tweet = content.tweets[0]?.text || '';
                const preview = tweet.length > 30 ? tweet.substring(0, 27) + '...' : tweet;
                return `${repo} — ${preview}`;
            } catch {
                return d.pr_title.split(' | ').slice(1).join(' | ').substring(0, 40);
            }
        }
        if (d.source === 'repost') {
            // Format: "@username | preview..."
            return d.pr_title.length > 40 ? d.pr_title.substring(0, 37) + '...' : d.pr_title;
        }
        if (d.source === 'handwrite') {
            try {
                const content = JSON.parse(d.content) as DraftContent;
                const tweet = content.tweets[0]?.text || d.pr_title;
                return tweet.length > 40 ? tweet.substring(0, 37) + '...' : tweet;
            } catch {
                return d.pr_title.length > 40 ? d.pr_title.substring(0, 37) + '...' : d.pr_title;
            }
        }
        return d.pr_title.length > 40 ? d.pr_title.substring(0, 37) + '...' : d.pr_title;
    }

    const draftLines = drafts.map((d) => {
        const emoji = statusEmoji[d.status] || '📄';
        return `${emoji} <b>${escapeHtml(getDraftDisplayTitle(d))}</b>`;
    });

    // Pre-fetch tweet URLs for published drafts
    const tweetUrls = new Map<string, string>();
    if (listType === 'published') {
        const pubs = await Promise.all(drafts.map(d => getPublishedByDraft(env, chatId, d.id)));
        for (let i = 0; i < drafts.length; i++) {
            if (pubs[i]?.tweet_url) tweetUrls.set(drafts[i].id, pubs[i]!.tweet_url!);
        }
    }

    // Two rows per draft: title row + quick action row
    const draftButtons: InlineButton[][] = [];
    for (const d of drafts) {
        const emoji = statusEmoji[d.status] || '📄';
        const title = getDraftDisplayTitle(d);
        // Row 1: title button (navigates to draft detail)
        draftButtons.push([{ text: `${emoji} ${title}`, callback_data: `draft:${d.id}` }]);
        // Row 2: quick action buttons based on status
        // Use abbreviated names to stay under Telegram's 64-byte callback_data limit
        const lt = listTypeToShort[listType] || listType;
        const ctx = `${d.id}:${lt}:${page}`;
        const actions: InlineButton[] = [];
        if (d.status === 'draft') {
            actions.push({ text: '✅', callback_data: `action:la:${ctx}`, style: 'success' });
        }
        if (d.status === 'approved') {
            actions.push({ text: '📤', callback_data: `action:lp:${ctx}`, style: 'success' });
        }
        if (d.status === 'scheduled') {
            actions.push({ text: '📤', callback_data: `action:lp:${ctx}`, style: 'success' });
        }
        if (d.status === 'published') {
            const url = tweetUrls.get(d.id);
            if (url) actions.push({ text: '🔗', url, style: 'primary' });
        }
        // Schedule button for all except scheduled and published
        if (d.status !== 'scheduled' && d.status !== 'published') {
            actions.push({ text: '📅', callback_data: `action:schedule:${d.id}`, style: 'primary' });
        }
        actions.push({ text: '🗑', callback_data: `action:ld:${ctx}`, style: 'danger' });
        draftButtons.push(actions);
    }

    const navButtons: InlineButton[] = [];
    if (page > 0) {
        navButtons.push({ text: '⬅️ Prev', callback_data: `page:${listType}:${page - 1}` });
    }
    if (page < totalPages - 1) {
        navButtons.push({ text: 'Next ➡️', callback_data: `page:${listType}:${page + 1}` });
    }

    return {
        text: `📝 <b>${typeLabel} Drafts</b> (${total} total)

${draftLines.join('\n')}

Page ${page + 1} of ${totalPages}`,
        keyboard: [
            ...draftButtons,
            navButtons.length > 0 ? navButtons : [],
            [{ text: '◀️ Back', callback_data: 'view:drafts' }, { text: '🏠 Home', callback_data: 'view:home' }],
        ].filter((row) => row.length > 0),
    };
}

export async function renderDraftDetail(env: Env, chatId: string, draftId: string, timezone = 'UTC'): Promise<ViewResult> {
    const draft = await getDraft(env, draftId, chatId);

    if (!draft) {
        return {
            text: `❌ <b>Draft Not Found</b>

This draft may have been deleted.`,
            keyboard: [[{ text: '◀️ Back', callback_data: 'view:drafts' }]],
        };
    }

    const content = JSON.parse(draft.content) as DraftContent;

    const tweetPreview = content.tweets
        .map((t, i) => {
            const mediaIndicator = t.mediaKey ? ' 📷' : '';
            return `<b>Tweet ${i + 1}:</b>${mediaIndicator} ${escapeHtml(t.text)} (${t.text.length}/280)`;
        })
        .join('\n\n');

    let statusLine = `${statusEmoji[draft.status]} <b>${draft.status.toUpperCase()}</b>`;
    if (draft.status === 'scheduled' && draft.scheduled_at) {
        statusLine += ` for ${formatLocalTime(draft.scheduled_at, timezone)}`;
    }

    let actionButtons: InlineButton[][] = [];

    switch (draft.status) {
        case 'draft':
            actionButtons = [
                [
                    { text: '✅ Approve', callback_data: `action:approve:${draft.id}`, style: 'success' },
                    { text: 'Delete', callback_data: `action:delete_draft:${draft.id}`, style: 'danger' },
                ],
                [
                    { text: draft.source === 'handwrite' ? '✨ AI Refine' : '✏️ Edit', callback_data: `action:edit:${draft.id}`, style: 'primary' as const },
                    { text: '📅 Schedule', callback_data: `action:schedule:${draft.id}`, style: 'primary' as const },
                ],
            ];
            break;
        case 'approved':
            actionButtons = [
                [
                    { text: '📤 Publish Now', callback_data: `action:publish:${draft.id}`, style: 'success' as const },
                    { text: '📅 Schedule', callback_data: `action:schedule:${draft.id}`, style: 'primary' as const },
                ],
            ];
            break;
        case 'scheduled':
            actionButtons = [
                [
                    { text: '📤 Publish Now', callback_data: `action:publish:${draft.id}`, style: 'success' as const },
                    { text: 'Cancel', callback_data: `action:unschedule:${draft.id}`, style: 'danger' },
                ],
            ];
            break;
        case 'published': {
            // Show tweet URL if available
            const published = await getPublishedByDraft(env, chatId, draft.id);
            if (published?.tweet_url) {
                actionButtons = [
                    [{ text: '🔗 View on X', url: published.tweet_url }],
                ];
            }
            break;
        }
    }

    let headerLabel: string;
    if (draft.source === 'repost') {
        headerLabel = '🔄 Repost Draft';
    } else if (draft.source === 'handwrite') {
        headerLabel = '✍️ Handwritten Draft';
    } else {
        headerLabel = `📋 Draft for PR #${draft.pr_number}`;
    }

    const originalLink = draft.original_tweet_url
        ? `\n🔗 <a href="${draft.original_tweet_url}">Original tweet</a>`
        : '';

    return {
        text: `${headerLabel}

<b>${escapeHtml(draft.pr_title)}</b>${originalLink}

${statusLine}
<b>Format:</b> ${content.format === 'single' ? 'Single Tweet' : `Thread (${content.tweets.length} tweets)`}

${tweetPreview}`,
        keyboard: [
            ...actionButtons,
            [{ text: '◀️ Back', callback_data: 'view:drafts' }],
        ],
    };
}

export function renderGeneratePrompt(): ViewResult {
    return {
        text: `⚡ <b>Generate Content</b>

Send me a commit SHA or PR number.

Example: <code>abc1234</code> or <code>42</code>

I'll find the PR and create engaging content for it!`,
        keyboard: [[{ text: '❌ Cancel', callback_data: 'view:home' }]],
    };
}

export function renderSchedulePrompt(): ViewResult {
    return {
        text: `📅 <b>Schedule Post</b>

Send me the commit SHA and datetime.

Format: <code>abc1234 2024-01-15 14:00</code>

The content will be generated now and published at the scheduled time.`,
        keyboard: [[{ text: '❌ Cancel', callback_data: 'view:home' }]],
    };
}

export function renderDeleteDraftConfirm(draftId: string, title: string): ViewResult {
    const safeTitle = escapeHtml(title.length > 60 ? title.substring(0, 57) + '...' : title);
    const text = `🗑 <b>Delete Draft?</b>

<b>${safeTitle}</b>

⚠️ This will permanently delete this draft. This action cannot be undone.`;

    // Keep under 1024 chars for photo caption compatibility
    const caption = truncateHtml(text, 1024);

    return {
        text: caption,
        keyboard: [
            [
                { text: 'Yes, Delete', callback_data: `action:confirm_delete:${draftId}`, style: 'danger' },
                { text: 'Cancel', callback_data: `action:cancel_delete:${draftId}` },
            ],
        ],
    };
}

export function renderDeletePrompt(): ViewResult {
    return {
        text: `🗑️ <b>Delete Posts</b>

Send me a commit SHA to find published posts from that PR.

Example: <code>abc1234</code>

I'll show you all posts so you can choose which to delete.`,
        keyboard: [[{ text: '❌ Cancel', callback_data: 'view:home' }]],
    };
}
