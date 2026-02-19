/**
 * Repository-related views
 */

import type { Env, ViewResult, InlineButton } from '../types';
import { getRepos, getRepo, parseRepoConfig, getRepoOverview } from '../services/db';
import { renderError } from './home';

export async function renderReposList(env: Env, chatId: string, page = 0): Promise<ViewResult> {
    const allRepos = await getRepos(env, chatId);

    if (allRepos.length === 0) {
        return {
            text: `📦 <b>Watched Repositories</b>

No repositories are being watched yet.

Add a repo to start auto-detecting new PRs and commits!`,
            keyboard: [
                [{ text: '➕ Add repo', callback_data: 'action:add_repo', style: 'primary' as const }],
                [{ text: '🏠 Home', callback_data: 'view:home' }],
            ],
        };
    }

    const limit = 10;
    const offset = page * limit;
    const totalPages = Math.ceil(allRepos.length / limit);
    const repos = allRepos.slice(offset, offset + limit);

    const repoList = repos.map((r, i) => {
        const status = r.is_watching ? '👁' : '⏸️';
        return `${offset + i + 1}. ${status} <code>${r.owner}/${r.repo}</code>`;
    }).join('\n');

    // One button per row
    const repoButtons: InlineButton[][] = repos.map((r) => [
        {
            text: `📦 ${r.owner}/${r.repo}${r.is_watching ? '' : ' (paused)'}`,
            callback_data: `repo:${r.id}`,
        },
    ]);

    const navButtons: InlineButton[] = [];
    if (page > 0) {
        navButtons.push({ text: '⬅️ Prev', callback_data: `page:repos:${page - 1}` });
    }
    if (page < totalPages - 1) {
        navButtons.push({ text: 'Next ➡️', callback_data: `page:repos:${page + 1}` });
    }

    return {
        text: `📦 <b>Watched Repositories</b> (${allRepos.length} total)

${repoList}

Tap a repo to manage settings.${totalPages > 1 ? `\n\nPage ${page + 1} of ${totalPages}` : ''}`,
        keyboard: [
            [{ text: '➕ Add repo', callback_data: 'action:add_repo', style: 'primary' as const }],
            ...repoButtons,
            navButtons.length > 0 ? navButtons : [],
            [{ text: '🏠 Home', callback_data: 'view:home' }],
        ].filter((row) => row.length > 0),
    };
}

export async function renderRepoDetail(env: Env, chatId: string, repoId: string): Promise<ViewResult> {
    const repo = await getRepo(env, repoId, chatId);

    if (!repo) {
        return renderError('Repository not found.');
    }

    const config = parseRepoConfig(repo);
    const watchStatus = repo.is_watching ? '👁 Watching' : '⏸️ Paused';

    const hashtagOn = config.includeHashtags;
    const prOn = config.watchPRs;
    const pushOn = config.watchPushes;
    const imgOn = config.alwaysGenerateThreadImage;
    const hashtagIcon = hashtagOn ? '✅' : '❌';
    const prIcon = prOn ? '✅' : '❌';
    const pushIcon = pushOn ? '✅' : '❌';
    const imgIcon = imgOn ? '✅' : '❌';
    const langLabel = config.language === 'en' ? '🇺🇸 EN' : '🇮🇱 HE';

    // Fetch overview for display
    const overview = await getRepoOverview(env, repoId, chatId);
    let overviewSection: string;
    const overviewButtons: InlineButton[][] = [];

    if (overview) {
        const summaryPreview = overview.summary
            ? overview.summary.length > 120 ? overview.summary.substring(0, 117) + '...' : overview.summary
            : 'No summary';
        const featureCount = overview.key_features.length;
        overviewSection = `\n<b>Project Overview:</b>
📋 ${summaryPreview}
⭐ ${featureCount} feature${featureCount !== 1 ? 's' : ''}${overview.visual_theme ? ` | 🎨 ${overview.visual_theme.substring(0, 40)}` : ''}`;
        overviewButtons.push([
            { text: '✏️ Edit Overview', callback_data: `config:edit_overview:${repo.id}` },
            { text: '🔄 Re-bootstrap', callback_data: `config:rebootstrap:${repo.id}` },
        ]);
    } else {
        overviewSection = `\n<b>Project Overview:</b>
No overview yet — run <code>/overview ${repo.owner}/${repo.repo}</code> to bootstrap.`;
        overviewButtons.push([
            { text: '🔍 Bootstrap Overview', callback_data: `config:rebootstrap:${repo.id}` },
        ]);
    }

    return {
        text: `📦 <b>${repo.owner}/${repo.repo}</b>
${watchStatus}

<b>Content Settings:</b>
${hashtagIcon} Hashtags: <b>${config.includeHashtags ? 'Yes' : 'No'}</b>
🌐 Language: <b>${config.language.toUpperCase()}</b>

<b>Watch Settings:</b>
${prIcon} PRs: <b>${config.watchPRs ? 'Yes' : 'No'}</b>
${pushIcon} Pushes: <b>${config.watchPushes ? 'Yes' : 'No'}</b>
📌 Branches: <b>${config.branches.join(', ')}</b>

<b>Image Settings:</b>
${imgIcon} Thread Image: <b>${config.alwaysGenerateThreadImage ? 'Always' : 'Off'}</b>
🎲 Single Prob: <b>${Math.round(config.singleTweetImageProbability * 100)}%</b>
${overviewSection}

Tap a setting to change it:`,
        keyboard: [
            [
                { text: langLabel, callback_data: `config:language:${repo.id}` },
                { text: `Tags: ${hashtagOn ? 'On' : 'Off'}`, callback_data: `config:hashtags:${repo.id}`, style: hashtagOn ? 'success' : 'danger' },
            ],
            [
                { text: `PRs: ${prOn ? 'On' : 'Off'}`, callback_data: `config:watchPRs:${repo.id}`, style: prOn ? 'success' : 'danger' },
                { text: `Push: ${pushOn ? 'On' : 'Off'}`, callback_data: `config:watchPushes:${repo.id}`, style: pushOn ? 'success' : 'danger' },
            ],
            [
                { text: `Img: ${imgOn ? 'On' : 'Off'}`, callback_data: `config:threadImage:${repo.id}`, style: imgOn ? 'success' : 'danger' },
                { text: `🎲 ${Math.round(config.singleTweetImageProbability * 100)}%`, callback_data: `config:singleImage:${repo.id}` },
            ],
            ...overviewButtons,
            [
                repo.is_watching
                    ? { text: 'Stop watching', callback_data: `action:unwatch:${repo.id}`, style: 'danger' as const }
                    : { text: 'Start watching', callback_data: `action:watch:${repo.id}`, style: 'success' as const },
            ],
            [{ text: 'Delete', callback_data: `action:delete_repo:${repo.id}`, style: 'danger' }],
            [{ text: '◀️ Back', callback_data: 'view:repos' }],
        ],
    };
}

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

export async function renderDeleteRepoConfirm(env: Env, chatId: string, repoId: string): Promise<ViewResult> {
    const repo = await getRepo(env, repoId, chatId);

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
                { text: 'Yes, delete', callback_data: `action:confirm_delete_repo:${repo.id}`, style: 'danger' },
                { text: 'Cancel', callback_data: `repo:${repo.id}` },
            ],
        ],
    };
}
