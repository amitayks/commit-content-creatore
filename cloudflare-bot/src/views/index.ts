/**
 * View Renderers - Generate Telegram message content and keyboards
 */

import type { Env, ViewResult, Draft, DraftContent, WatchedRepo, RepoConfig } from '../types';
import { getAllDrafts, countDrafts, getDraft, getRepos, getRepo, parseRepoConfig } from '../services/db';

/**
 * Render the home dashboard
 */
export function renderHome(): ViewResult {
    return {
        text: `🤖 <b>Content Bot Dashboard</b>

Welcome! I help you create and publish content from your GitHub PRs.

<b>Quick Actions:</b>
• <b>Approve</b> - Publish all approved drafts
• <b>Generate</b> - Create content from a commit
• <b>Drafts</b> - View and manage your drafts
• <b>Repos</b> - Manage watched repositories

Use the buttons below or type commands like /generate`,
        keyboard: [
            [
                { text: '🚀 Publish', callback_data: 'action:publish_approved' },
                { text: '⚡ Generate', callback_data: 'view:generate' },
            ],
            [
                { text: '📝 Drafts', callback_data: 'view:drafts' },
                { text: '📦 Repos', callback_data: 'view:repos' },
            ],
            [
                { text: '❓ Help', callback_data: 'view:help' },
                { text: '📅 Schedule', callback_data: 'view:schedule' },
            ],
        ],
    };
}

/**
 * Render the drafts list with pagination
 */
export async function renderDraftsList(env: Env, page = 0): Promise<ViewResult> {
    const limit = 5;
    const offset = page * limit;
    const drafts = await getAllDrafts(env, undefined, limit, offset);
    const total = await countDrafts(env);
    const totalPages = Math.ceil(total / limit);

    if (drafts.length === 0) {
        return {
            text: `📝 <b>Drafts</b>

No drafts yet. Use ⚡ Generate to create one!`,
            keyboard: [[{ text: '🏠 Home', callback_data: 'view:home' }]],
        };
    }

    const statusEmoji: Record<string, string> = {
        draft: '📝',
        approved: '✅',
        scheduled: '📅',
        rejected: '❌',
        published: '📤',
    };

    const draftLines = drafts.map((d) => {
        const emoji = statusEmoji[d.status] || '📄';
        const title = d.pr_title.length > 25 ? d.pr_title.substring(0, 25) + '...' : d.pr_title;
        return `${emoji} <b>${title}</b> (PR #${d.pr_number})`;
    });

    const draftButtons = drafts.map((d) => ({
        text: `${statusEmoji[d.status]} PR #${d.pr_number}`,
        callback_data: `draft:${d.id}`,
    }));

    // Pagination buttons
    const navButtons: { text: string; callback_data: string }[] = [];
    if (page > 0) {
        navButtons.push({ text: '⬅️ Prev', callback_data: `page:${page - 1}` });
    }
    if (page < totalPages - 1) {
        navButtons.push({ text: 'Next ➡️', callback_data: `page:${page + 1}` });
    }

    return {
        text: `📝 <b>Drafts</b> (${total} total)

${draftLines.join('\n')}

Page ${page + 1} of ${totalPages}`,
        keyboard: [
            draftButtons.slice(0, 3),
            draftButtons.slice(3, 5),
            navButtons.length > 0 ? navButtons : [],
            [{ text: '🏠 Home', callback_data: 'view:home' }],
        ].filter((row) => row.length > 0),
    };
}

/**
 * Render a single draft detail
 */
export async function renderDraftDetail(env: Env, draftId: string): Promise<ViewResult> {
    const draft = await getDraft(env, draftId);

    if (!draft) {
        return {
            text: `❌ <b>Draft Not Found</b>

This draft may have been deleted.`,
            keyboard: [[{ text: '◀️ Back', callback_data: 'view:drafts' }]],
        };
    }

    const content = JSON.parse(draft.content) as DraftContent;
    const statusEmoji: Record<string, string> = {
        draft: '📝',
        approved: '✅',
        scheduled: '📅',
        rejected: '❌',
        published: '📤',
    };

    const tweetPreview = content.tweets
        .map((t, i) => `<b>Tweet ${i + 1}:</b> ${t.text} (${t.text.length}/280)`)
        .join('\n\n');

    let statusLine = `${statusEmoji[draft.status]} <b>${draft.status.toUpperCase()}</b>`;
    if (draft.status === 'scheduled' && draft.scheduled_at) {
        const date = new Date(draft.scheduled_at);
        statusLine += ` for ${date.toLocaleDateString()} at ${date.toLocaleTimeString()}`;
    }

    // Action buttons based on status
    let actionButtons: { text: string; callback_data: string }[][] = [];

    switch (draft.status) {
        case 'draft':
            actionButtons = [
                [
                    { text: '✅ Approve', callback_data: `action:approve:${draft.id}` },
                    { text: '✏️ Edit', callback_data: `action:edit:${draft.id}` },
                    { text: '❌ Reject', callback_data: `action:reject:${draft.id}` },
                ],
                [
                    { text: '🔄 Regenerate', callback_data: `action:regenerate:${draft.id}` },
                    { text: '📅 Schedule', callback_data: `action:schedule:${draft.id}` },
                ],
            ];
            break;
        case 'approved':
            actionButtons = [
                [
                    { text: '📤 Publish Now', callback_data: `action:publish:${draft.id}` },
                    { text: '📅 Schedule', callback_data: `action:schedule:${draft.id}` },
                ],
                [{ text: '❌ Cancel', callback_data: `action:reject:${draft.id}` }],
            ];
            break;
        case 'scheduled':
            actionButtons = [
                [
                    { text: '📤 Publish Now', callback_data: `action:publish:${draft.id}` },
                    { text: '❌ Cancel', callback_data: `action:unschedule:${draft.id}` },
                ],
            ];
            break;
    }

    return {
        text: `📋 <b>Draft for PR #${draft.pr_number}</b>

<b>${draft.pr_title}</b>

${statusLine}
<b>Format:</b> ${content.format === 'single' ? 'Single Tweet' : `Thread (${content.tweets.length} tweets)`}

${tweetPreview}`,
        keyboard: [...actionButtons, [{ text: '◀️ Back', callback_data: 'view:drafts' }]],
    };
}

/**
 * Render help view
 */
export function renderHelp(): ViewResult {
    return {
        text: `❓ <b>Help - How to Use This Bot</b>

<b>Commands:</b>
• /start - Show dashboard
• /generate [sha] - Generate content from commit
• /approve - Publish all approved drafts
• /drafts - View drafts list
• /help - Show this help
• /schedule [sha] [datetime] - Schedule post
• /delete [sha] - Delete published posts

<b>Workflow:</b>
1️⃣ Use <b>Generate</b> with a commit SHA
2️⃣ Review the draft, <b>Approve</b> or <b>Reject</b>
3️⃣ Approved drafts can be published or scheduled

<b>Tips:</b>
• Any commit SHA is resolved to its parent PR
• Image is generated automatically when publishing
• Scheduled posts publish automatically`,
        keyboard: [[{ text: '🏠 Home', callback_data: 'view:home' }]],
    };
}

/**
 * Render generate prompt
 */
export function renderGeneratePrompt(): ViewResult {
    return {
        text: `⚡ <b>Generate Content</b>

Send me a commit SHA or PR number.

Example: <code>abc1234</code> or <code>42</code>

I'll find the PR and create engaging content for it!`,
        keyboard: [[{ text: '❌ Cancel', callback_data: 'view:home' }]],
    };
}

/**
 * Render schedule prompt
 */
export function renderSchedulePrompt(): ViewResult {
    return {
        text: `📅 <b>Schedule Post</b>

Send me the commit SHA and datetime.

Format: <code>abc1234 2024-01-15 14:00</code>

The content will be generated now and published at the scheduled time.`,
        keyboard: [[{ text: '❌ Cancel', callback_data: 'view:home' }]],
    };
}

/**
 * Render delete prompt
 */
export function renderDeletePrompt(): ViewResult {
    return {
        text: `🗑️ <b>Delete Posts</b>

Send me a commit SHA to find published posts from that PR.

Example: <code>abc1234</code>

I'll show you all posts so you can choose which to delete.`,
        keyboard: [[{ text: '❌ Cancel', callback_data: 'view:home' }]],
    };
}

/**
 * Render generating status
 */
export function renderGenerating(sha: string): ViewResult {
    return {
        text: `🔄 <b>Generating...</b>

Finding PR for commit <code>${sha}</code>...

This may take a moment.`,
        keyboard: [],
    };
}

/**
 * Render publishing status
 */
export function renderPublishing(count: number): ViewResult {
    return {
        text: `📤 <b>Publishing...</b>

Publishing ${count} draft${count > 1 ? 's' : ''} to X...

Please wait.`,
        keyboard: [],
    };
}

/**
 * Render error
 */
export function renderError(message: string): ViewResult {
    return {
        text: `❌ <b>Error</b>

${message}

Tap Home to return to the dashboard.`,
        keyboard: [[{ text: '🏠 Home', callback_data: 'view:home' }]],
    };
}

/**
 * Render success
 */
export function renderSuccess(message: string): ViewResult {
    return {
        text: `✅ <b>Success!</b>

${message}`,
        keyboard: [[{ text: '🏠 Home', callback_data: 'view:home' }]],
    };
}

// ==================== REPO VIEWS ====================

/**
 * Render repos list
 */
export async function renderReposList(env: Env): Promise<ViewResult> {
    const repos = await getRepos(env);

    if (repos.length === 0) {
        return {
            text: `📦 <b>Watched Repositories</b>

No repositories are being watched yet.

Add a repo to start auto-detecting new PRs and commits!`,
            keyboard: [
                [{ text: '➕ Add repo', callback_data: 'action:add_repo' }],
                [{ text: '🏠 Home', callback_data: 'view:home' }],
            ],
        };
    }

    // Build repo list text
    const repoList = repos.map((r, i) => {
        const status = r.is_watching ? '👁' : '⏸️';
        return `${i + 1}. ${status} <code>${r.owner}/${r.repo}</code>`;
    }).join('\n');

    // Build repo buttons (2 per row)
    const repoButtons: { text: string; callback_data: string }[][] = [];
    for (let i = 0; i < repos.length; i += 2) {
        const row: { text: string; callback_data: string }[] = [];
        row.push({
            text: `📦 ${repos[i].owner}/${repos[i].repo}`,
            callback_data: `repo:${repos[i].id}`,
        });
        if (repos[i + 1]) {
            row.push({
                text: `📦 ${repos[i + 1].owner}/${repos[i + 1].repo}`,
                callback_data: `repo:${repos[i + 1].id}`,
            });
        }
        repoButtons.push(row);
    }

    return {
        text: `📦 <b>Watched Repositories</b>

${repoList}

Tap a repo to view details or manage settings.`,
        keyboard: [
            [{ text: '➕ Add repo', callback_data: 'action:add_repo' }],
            ...repoButtons,
            [{ text: '🏠 Home', callback_data: 'view:home' }],
        ],
    };
}

/**
 * Render repo detail view
 */
export async function renderRepoDetail(env: Env, repoId: string): Promise<ViewResult> {
    const repo = await getRepo(env, repoId);

    if (!repo) {
        return renderError('Repository not found.');
    }

    const config = parseRepoConfig(repo);
    const watchStatus = repo.is_watching ? '👁 Watching' : '⏸️ Paused';
    const prStatus = config.watchPRs ? '✓' : '✗';
    const pushStatus = config.watchPushes ? '✓' : '✗';

    return {
        text: `📦 <b>Repository Details</b>

<b>Repo:</b> <code>${repo.owner}/${repo.repo}</code>
<b>Status:</b> ${watchStatus}

<b>Configuration:</b>
• Tone: ${config.tone}
• Hashtags: ${config.includeHashtags ? '✓' : '✗'}
• Watch PRs: ${prStatus}
• Watch Pushes: ${pushStatus}
• Branches: ${config.branches.join(', ')}
• Platform: ${config.platform.toUpperCase()}

<i>Webhook ID: ${repo.webhook_id || 'Not set'}</i>`,
        keyboard: [
            [
                repo.is_watching
                    ? { text: '⏸️ Stop watching', callback_data: `action:unwatch:${repo.id}` }
                    : { text: '👁 Start watching', callback_data: `action:watch:${repo.id}` },
            ],
            [
                { text: '✏️ Edit', callback_data: `action:edit_repo:${repo.id}` },
                { text: '🗑️ Delete', callback_data: `action:delete_repo:${repo.id}` },
            ],
            [{ text: '◀️ Back', callback_data: 'view:repos' }],
        ],
    };
}

/**
 * Render add repo prompt
 */
export function renderAddRepo(): ViewResult {
    return {
        text: `➕ <b>Add Repository</b>

Send me the repository in <code>owner/repo</code> format.

<b>Example:</b>
<code>ozkeisar/work-content-tracker</code>

I'll set up a webhook to auto-detect new PRs and commits.`,
        keyboard: [[{ text: '❌ Cancel', callback_data: 'view:repos' }]],
    };
}

/**
 * Render delete repo confirmation
 */
export async function renderDeleteRepoConfirm(env: Env, repoId: string): Promise<ViewResult> {
    const repo = await getRepo(env, repoId);

    if (!repo) {
        return renderError('Repository not found.');
    }

    return {
        text: `🗑️ <b>Delete Repository?</b>

Are you sure you want to delete:
<code>${repo.owner}/${repo.repo}</code>

This will also remove the webhook from GitHub.`,
        keyboard: [
            [
                { text: '✅ Yes, delete', callback_data: `action:confirm_delete_repo:${repo.id}` },
                { text: '❌ Cancel', callback_data: `repo:${repo.id}` },
            ],
        ],
    };
}

/**
 * Render repo config editing view
 */
export async function renderRepoConfig(env: Env, repoId: string): Promise<ViewResult> {
    const repo = await getRepo(env, repoId);

    if (!repo) {
        return renderError('Repository not found.');
    }

    const config = parseRepoConfig(repo);

    // Build toggle indicators
    const toneIcon = config.tone === 'professional' ? '💼' : config.tone === 'casual' ? '😎' : '🔧';
    const hashtagIcon = config.includeHashtags ? '✅' : '❌';
    const prIcon = config.watchPRs ? '✅' : '❌';
    const pushIcon = config.watchPushes ? '✅' : '❌';
    const imgIcon = config.alwaysGenerateThreadImage ? '✅' : '❌';

    // Code context labels
    const contextLabels: Record<string, string> = {
        'metadata': '📝 Meta',
        'with_diff': '📊 +Diff',
        'with_files': '📁 +Files',
        'with_content': '⚠️ +Content',
    };
    const contextLabel = contextLabels[config.codeContext] || config.codeContext;

    // Language labels
    const langLabel = config.language === 'en' ? '🇺🇸 EN' : '🇮🇱 HE';

    return {
        text: `✏️ <b>Edit Configuration</b>

<b>Repo:</b> <code>${repo.owner}/${repo.repo}</code>

<b>Content Settings:</b>
${toneIcon} Tone: <b>${config.tone}</b>
${hashtagIcon} Hashtags: <b>${config.includeHashtags ? 'Yes' : 'No'}</b>
🌐 Language: <b>${config.language.toUpperCase()}</b>
📦 Context: <b>${config.codeContext}</b>

<b>Watch Settings:</b>
${prIcon} PRs: <b>${config.watchPRs ? 'Yes' : 'No'}</b>
${pushIcon} Pushes: <b>${config.watchPushes ? 'Yes' : 'No'}</b>
📌 Branches: <b>${config.branches.join(', ')}</b>

<b>Image Settings:</b>
${imgIcon} Thread Image: <b>${config.alwaysGenerateThreadImage ? 'Always' : 'Off'}</b>
🎲 Single Prob: <b>${Math.round(config.singleTweetImageProbability * 100)}%</b>

Tap a setting to change it:`,
        keyboard: [
            [
                { text: `${toneIcon} Tone`, callback_data: `config:tone:${repo.id}` },
                { text: langLabel, callback_data: `config:language:${repo.id}` },
            ],
            [
                { text: contextLabel, callback_data: `config:codeContext:${repo.id}` },
                { text: `${hashtagIcon} Tags`, callback_data: `config:hashtags:${repo.id}` },
            ],
            [
                { text: `${prIcon} PRs`, callback_data: `config:watchPRs:${repo.id}` },
                { text: `${pushIcon} Push`, callback_data: `config:watchPushes:${repo.id}` },
            ],
            [
                { text: `${imgIcon} Img`, callback_data: `config:threadImage:${repo.id}` },
                { text: `🎲 ${Math.round(config.singleTweetImageProbability * 100)}%`, callback_data: `config:singleImage:${repo.id}` },
            ],
            [{ text: '◀️ Back', callback_data: `repo:${repo.id}` }],
        ],
    };
}
