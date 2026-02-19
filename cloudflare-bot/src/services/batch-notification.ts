/**
 * Batch Notification Service — Sends scored tweet summaries to Telegram
 *
 * Groups scored tweets per chat, builds paginated HTML messages with inline buttons,
 * and stores the batch_message_id for later edit-in-place.
 */

import type { Env, TwitterAccount, TwitterTweet } from '../types';
import { parseTwitterAccountConfig, updateTwitterTweet } from './db';
import { sendMessage } from './telegram';

/**
 * Send batch notifications for all scored tweets from this polling cycle
 */
export async function sendBatchNotifications(
    env: Env,
    accounts: TwitterAccount[]
): Promise<void> {
    // Group scored tweets by chat_id
    const chatTweets: Record<string, Array<{ tweet: TwitterTweet; account: TwitterAccount }>> = {};
    // Track page size per chat (use the first account's config)
    const chatPageSize: Record<string, number> = {};

    for (const account of accounts) {
        const config = parseTwitterAccountConfig(account);

        // Get tweets that were just scored
        const result = await env.DB.prepare(
            "SELECT * FROM twitter_tweets WHERE account_id = ? AND status = 'scored' ORDER BY relevance_score DESC"
        )
            .bind(account.id)
            .all<TwitterTweet>();

        const scoredTweets = result.results || [];

        for (const tweet of scoredTweets) {
            // Filter by threshold — skip tweets below account's threshold
            if (tweet.relevance_score !== null && tweet.relevance_score < config.relevanceThreshold) {
                await updateTwitterTweet(env, tweet.id, { status: 'skipped' });
                continue;
            }

            if (!chatTweets[account.chat_id]) {
                chatTweets[account.chat_id] = [];
                chatPageSize[account.chat_id] = config.batchPageSize || 5;
            }
            chatTweets[account.chat_id].push({ tweet, account });
        }
    }

    // Send paginated batch messages per chat
    for (const [chatId, items] of Object.entries(chatTweets)) {
        if (items.length === 0) continue;

        const pageSize = chatPageSize[chatId] || 5;
        const totalPages = Math.ceil(items.length / pageSize);

        try {
            // Send page 1
            const pageItems = items.slice(0, pageSize);
            const { text, keyboard } = buildBatchPage(pageItems, 0, totalPages, items.length);
            const messageId = await sendMessage(env, chatId, text, keyboard);

            // Store batch_message_id and mark as notified so they don't appear again
            for (const { tweet } of items) {
                await updateTwitterTweet(env, tweet.id, { batch_message_id: messageId, status: 'notified' });
            }

            console.log(`[batch] Sent notification to chat ${chatId}: ${items.length} tweets, ${totalPages} pages (msg: ${messageId})`);
        } catch (error) {
            console.error(`[batch] Failed to send notification to chat ${chatId}:`, error);
        }
    }
}

/**
 * Build a single page of the batch notification
 */
export function buildBatchPage(
    items: Array<{ tweet: TwitterTweet; account: TwitterAccount }>,
    page: number,
    totalPages: number,
    totalItems: number
): { text: string; keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> } {
    const pageLabel = totalPages > 1 ? ` (${page + 1}/${totalPages})` : '';
    const lines: string[] = [`🔔 <b>New Tweets Detected</b>${pageLabel}\n`];

    for (const { tweet, account } of items) {
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
        lines.push(`<i>${totalItems} tweets total</i>`);
    }

    const text = lines.join('\n');

    // Build keyboard — 2 buttons per tweet row: [Generate] [Open Tweet]
    const keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> = [];

    for (const { tweet, account } of items) {
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

    // Add navigation buttons
    if (totalPages > 1) {
        const navRow: Array<{ text: string; callback_data: string }> = [];
        if (page > 0) {
            navRow.push({ text: '⬅️ Prev', callback_data: `tw_batch:${page - 1}` });
        }
        if (page < totalPages - 1) {
            navRow.push({ text: 'Next ➡️', callback_data: `tw_batch:${page + 1}` });
        }
        if (navRow.length > 0) {
            keyboard.push(navRow);
        }
    }

    return { text, keyboard };
}
