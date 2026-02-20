/**
 * Twitter Account views — list, detail, add, delete confirm
 */

import type { Env, ViewResult, InlineButton, TwitterAccountConfig } from '../types';
import { getTwitterAccounts, getTwitterAccount, parseTwitterAccountConfig, getTwitterAccountOverview } from '../services/db';
import { renderError } from './home';

export async function renderAccountsList(env: Env, chatId: string, page = 0): Promise<ViewResult> {
    const allAccounts = await getTwitterAccounts(env, chatId);

    if (allAccounts.length === 0) {
        return {
            text: `👤 <b>Followed Accounts</b>

No accounts are being followed yet.

Add a Twitter/X account to start auto-detecting new tweets for repost!`,
            keyboard: [
                [{ text: '➕ Add account', callback_data: 'action:add_account', style: 'primary' as const }],
                [{ text: '🏠 Home', callback_data: 'view:home' }],
            ],
        };
    }

    const limit = 10;
    const offset = page * limit;
    const totalPages = Math.ceil(allAccounts.length / limit);
    const accounts = allAccounts.slice(offset, offset + limit);

    const accountList = accounts.map((a, i) => {
        const status = a.is_watching ? '👁' : '⏸️';
        const name = a.display_name ? ` (${a.display_name})` : '';
        return `${offset + i + 1}. ${status} <a href="https://x.com/${a.username}">@${a.username}</a>${name}`;
    }).join('\n');

    const accountButtons: InlineButton[][] = accounts.map((a) => [
        {
            text: `👤 @${a.username}${a.is_watching ? '' : ' (paused)'}`,
            callback_data: `account:${a.id}`,
        },
    ]);

    const navButtons: InlineButton[] = [];
    if (page > 0) {
        navButtons.push({ text: '⬅️ Prev', callback_data: `page:accounts:${page - 1}` });
    }
    if (page < totalPages - 1) {
        navButtons.push({ text: 'Next ➡️', callback_data: `page:accounts:${page + 1}` });
    }

    return {
        text: `👤 <b>Followed Accounts</b> (${allAccounts.length} total)

${accountList}

Tap an account to manage settings.${totalPages > 1 ? `\n\nPage ${page + 1} of ${totalPages}` : ''}`,
        keyboard: [
            [{ text: '➕ Add account', callback_data: 'action:add_account', style: 'primary' as const }],
            ...accountButtons,
            navButtons.length > 0 ? navButtons : [],
            [{ text: '🏠 Home', callback_data: 'view:home' }],
        ].filter((row) => row.length > 0),
        disableLinkPreview: true,
    };
}

export async function renderAccountDetail(env: Env, chatId: string, accountId: string): Promise<ViewResult> {
    const account = await getTwitterAccount(env, accountId, chatId);

    if (!account) {
        return renderError('Account not found.');
    }

    const config = parseTwitterAccountConfig(account);
    const watchStatus = account.is_watching ? '👁 Watching' : '⏸️ Paused';

    const hashtagOn = config.includeHashtags;
    const imgOn = config.alwaysGenerateImage;
    const hashtagIcon = hashtagOn ? '✅' : '❌';
    const imgIcon = imgOn ? '✅' : '❌';
    const langLabel = config.language === 'en' ? '🇺🇸 EN' : '🇮🇱 HE';
    const autoApproveOn = config.autoApprove;
    const mediaAiOn = config.analyzeMedia !== false;
    const autoApproveIcon = autoApproveOn ? '✅' : '❌';
    const mediaAiIcon = mediaAiOn ? '✅' : '❌';
    const batchSize = config.batchPageSize || 5;

    const toneLabels: Record<string, string> = {
        professional: '💼 Professional',
        casual: '😎 Casual',
        analytical: '🔬 Analytical',
        enthusiastic: '🔥 Enthusiastic',
        witty: '🧠 Witty',
        sarcastic: '😏 Sarcastic',
    };
    const toneLabel = toneLabels[config.tone] || config.tone;

    // Fetch overview
    const overview = await getTwitterAccountOverview(env, chatId, accountId);
    let overviewSection: string;

    if (overview?.persona) {
        const personaPreview = overview.persona.length > 120
            ? overview.persona.substring(0, 117) + '...'
            : overview.persona;
        overviewSection = `\n<b>Persona:</b>\n${personaPreview}`;
    } else {
        overviewSection = `\n<b>Persona:</b>\nNo persona yet — tap Bootstrap to generate one.`;
    }

    const displayName = account.display_name ? ` (${account.display_name})` : '';

    return {
        text: `👤 <b><a href="https://x.com/${account.username}">@${account.username}</a></b>${displayName}
${watchStatus}

<b>Repost Settings:</b>
${hashtagIcon} Hashtags: <b>${config.includeHashtags ? 'Yes' : 'No'}</b>
🌐 Language: <b>${config.language.toUpperCase()}</b>
🎯 Threshold: <b>${config.relevanceThreshold}/10</b>
🎭 Tone: <b>${toneLabel}</b>
${autoApproveIcon} Auto-approve: <b>${config.autoApprove ? 'Yes' : 'No'}</b>
📋 Batch page: <b>${batchSize}</b>
${mediaAiIcon} Media AI: <b>${config.analyzeMedia !== false ? 'Yes' : 'No'}</b>

<b>Image Settings:</b>
${imgIcon} Always Image: <b>${config.alwaysGenerateImage ? 'Yes' : 'No'}</b>
🎲 Single Prob: <b>${Math.round(config.singleImageProbability * 100)}%</b>
${overviewSection}

Tap a setting to change it:`,
        keyboard: [
            [
                { text: langLabel, callback_data: `tw_config:language:${account.id}` },
                { text: `Tags: ${hashtagOn ? 'On' : 'Off'}`, callback_data: `tw_config:hashtags:${account.id}`, style: hashtagOn ? 'success' : 'danger' },
            ],
            [
                { text: `🎯 ${config.relevanceThreshold}/10`, callback_data: `tw_config:threshold:${account.id}` },
                { text: toneLabel, callback_data: `tw_config:tone:${account.id}` },
            ],
            [
                { text: `Img: ${imgOn ? 'On' : 'Off'}`, callback_data: `tw_config:img:${account.id}`, style: imgOn ? 'success' : 'danger' },
                { text: `🎲 ${Math.round(config.singleImageProbability * 100)}%`, callback_data: `tw_config:img_pct:${account.id}` },
            ],
            [
                { text: `Auto: ${autoApproveOn ? 'On' : 'Off'}`, callback_data: `tw_config:auto_approve:${account.id}`, style: autoApproveOn ? 'success' : 'danger' },
                { text: `📋 Page: ${batchSize}`, callback_data: `tw_config:batch_size:${account.id}` },
            ],
            [
                { text: `Media AI: ${mediaAiOn ? 'On' : 'Off'}`, callback_data: `tw_config:analyze_media:${account.id}`, style: mediaAiOn ? 'success' : 'danger' },
            ],
            [
                { text: overview?.persona ? '🔍 Update Persona' : '🔍 Bootstrap Persona', callback_data: `action:tw_bootstrap:${account.id}`, style: overview?.persona ? 'success' as const : 'primary' as const },
            ],
            [
                account.is_watching
                    ? { text: 'Unfollow', callback_data: `action:tw_unfollow:${account.id}`, style: 'danger' as const }
                    : { text: 'Follow', callback_data: `action:tw_follow:${account.id}`, style: 'success' as const },
            ],
            [{ text: 'Delete', callback_data: `action:tw_delete:${account.id}`, style: 'danger' }],
            [{ text: '◀️ Back', callback_data: 'view:accounts' }],
        ],
        disableLinkPreview: true,
    };
}

export function renderAddAccount(): ViewResult {
    return {
        text: `➕ <b>Add Twitter Account</b>

Send me the Twitter/X username to follow.

<b>Example:</b>
<code>@vercel</code> or <code>vercel</code>

I'll start watching for their new tweets and notify you when there's something worth reposting.`,
        keyboard: [[{ text: '❌ Cancel', callback_data: 'view:accounts' }]],
    };
}

export async function renderDeleteAccountConfirm(env: Env, chatId: string, accountId: string): Promise<ViewResult> {
    const account = await getTwitterAccount(env, accountId, chatId);

    if (!account) {
        return renderError('Account not found.');
    }

    return {
        text: `🗑️ <b>Delete Account?</b>

Are you sure you want to stop following:
<b>@${account.username}</b>

This will also delete all stored tweets and persona data for this account.`,
        keyboard: [
            [
                { text: 'Yes, delete', callback_data: `action:tw_delete_yes:${account.id}`, style: 'danger' },
                { text: 'Cancel', callback_data: `account:${account.id}` },
            ],
        ],
    };
}
