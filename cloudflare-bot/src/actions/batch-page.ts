/**
 * Batch Page Action — Navigate paginated batch notifications
 *
 * Callback format: tw_batch:PAGE_NUMBER
 * Edits the batch message to show the requested page of scored tweets.
 */

import type { ActionHandler } from '../core/router';
import type { TwitterTweet, TwitterAccount } from '../types';
import { getScoredTweetsByBatchMessage, getTwitterAccount, parseTwitterAccountConfig } from '../services/db';
import { editMessage } from '../services/telegram';

export const batchPageAction: ActionHandler = async (ctx) => {
    const page = parseInt(ctx.value, 10);
    if (isNaN(page) || page < 0) return;

    const batchMessageId = ctx.messageId;
    if (!batchMessageId) return;

    // Get all tweets in this batch
    const tweets = await getScoredTweetsByBatchMessage(ctx.env, ctx.chatId, batchMessageId);
    if (tweets.length === 0) return;

    // Fetch accounts
    const accountIds = [...new Set(tweets.map(t => t.account_id))];
    const accounts = new Map<string, TwitterAccount>();
    let pageSize = 5;

    for (const accountId of accountIds) {
        const account = await getTwitterAccount(ctx.env, accountId, ctx.chatId);
        if (account) {
            accounts.set(accountId, account);
            const config = parseTwitterAccountConfig(account);
            pageSize = config.batchPageSize || 5;
        }
    }

    const totalPages = Math.ceil(tweets.length / pageSize);
    const safePage = Math.min(page, totalPages - 1);
    const offset = safePage * pageSize;
    const pageItems = tweets.slice(offset, offset + pageSize).map(tweet => ({
        tweet,
        account: accounts.get(tweet.account_id)!,
    })).filter(item => item.account);

    // Build page content
    const pageLabel = totalPages > 1 ? ` (${safePage + 1}/${totalPages})` : '';
    const lines: string[] = [`🔔 <b>New Tweets Detected</b>${pageLabel}\n`];

    for (const { tweet, account } of pageItems) {
        const score = tweet.relevance_score || 0;
        const scoreEmoji = score >= 8 ? '🔥' : score >= 6 ? '⭐' : '📝';
        const threadLabel = tweet.is_thread ? ' [Thread]' : '';
        const preview = tweet.text.substring(0, 80).replace(/\n/g, ' ');

        lines.push(`${scoreEmoji} <b>@${account.username}</b> (${score}/10)${threadLabel}`);
        lines.push(`${preview}${tweet.text.length > 80 ? '...' : ''}`);
        if (tweet.relevance_reason) {
            lines.push(`<i>${tweet.relevance_reason}</i>`);
        }
        lines.push('');
    }

    if (totalPages > 1) {
        lines.push(`<i>${tweets.length} tweets total</i>`);
    }

    const keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> = [];

    for (const { tweet, account } of pageItems) {
        const row: Array<{ text: string; callback_data?: string; url?: string }> = [];
        if (tweet.draft_id) {
            row.push({ text: '✅ Generated', callback_data: `draft:${tweet.draft_id}` });
        } else {
            row.push({ text: `⚡ Generate @${account.username}`, callback_data: `action:tw_gen:${tweet.id}` });
        }
        if (tweet.tweet_url) {
            row.push({ text: '🔗 Open', url: tweet.tweet_url });
        }
        keyboard.push(row);
    }

    // Navigation buttons
    if (totalPages > 1) {
        const navRow: Array<{ text: string; callback_data: string }> = [];
        if (safePage > 0) {
            navRow.push({ text: '⬅️ Prev', callback_data: `tw_batch:${safePage - 1}` });
        }
        if (safePage < totalPages - 1) {
            navRow.push({ text: 'Next ➡️', callback_data: `tw_batch:${safePage + 1}` });
        }
        if (navRow.length > 0) {
            keyboard.push(navRow);
        }
    }

    await editMessage(ctx.env, ctx.chatId, batchMessageId, lines.join('\n'), keyboard);
};
