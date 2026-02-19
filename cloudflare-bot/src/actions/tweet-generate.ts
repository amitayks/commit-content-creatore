/**
 * Tweet Generate Action — Handler for action:tw_gen:TWEET_ID
 *
 * Called when user clicks [Generate] on a batch notification.
 * Generates repost content, creates a draft, updates tweet status,
 * edits the batch notification button for that tweet, and sends a
 * separate "ready" message with a [View] button.
 */

import type { HandlerContext } from '../core/router';
import type { ViewResult } from '../types';
import { getTwitterTweet, getTwitterAccount, updateTwitterTweet, getScoredTweetsByBatchMessage, createDraft, parseTwitterAccountConfig } from '../services/db';
import { generateRepostContent } from '../services/repost-generate';
import { editMessage, sendMessage } from '../services/telegram';
import { renderError } from '../views';

export async function tweetGenerateAction(ctx: HandlerContext & { extra?: string }): Promise<ViewResult | void> {
    const tweetId = ctx.extra!;

    const tweet = await getTwitterTweet(ctx.env, ctx.chatId, tweetId);
    if (!tweet) {
        return renderError('Tweet not found.');
    }

    // Check if already drafted
    if (tweet.draft_id) {
        return renderError('A draft has already been generated for this tweet.');
    }

    const account = await getTwitterAccount(ctx.env, tweet.account_id, ctx.chatId);
    if (!account) {
        return renderError('Account not found.');
    }

    const config = parseTwitterAccountConfig(account);

    // Generate content (with media if enabled)
    const imageUrl = config.analyzeMedia ? tweet.media_url : null;
    const content = await generateRepostContent(ctx.env, tweet, account.id, config, undefined, imageUrl);
    if (!content) {
        return renderError('Failed to generate content. Please try again.');
    }

    // Create draft
    const tweetPreview = tweet.text.substring(0, 30).replace(/\n/g, ' ');
    const draftId = await createDraft(ctx.env, ctx.chatId, {
        pr_number: 0,
        pr_title: `@${account.username} | ${tweetPreview}...`,
        commit_sha: tweet.id,
        source: 'repost',
        content: JSON.stringify(content),
        original_tweet_id: tweet.id,
        original_tweet_url: tweet.tweet_url || undefined,
    });

    // Update tweet status
    await updateTwitterTweet(ctx.env, tweetId, {
        status: 'drafted',
        draft_id: draftId,
    });

    // Edit batch message in-place (just update buttons, keep content)
    if (tweet.batch_message_id) {
        try {
            await rebuildBatchMessage(ctx.env, ctx.chatId, tweet.batch_message_id);
        } catch (error) {
            console.error('[tw_gen] Failed to edit batch message:', error);
        }
    }

    // Send a separate "ready" notification
    await sendMessage(ctx.env, ctx.chatId,
        `✅ <b>Repost draft generated!</b>\n\nFrom <b>@${account.username}</b>\n<i>${tweetPreview}...</i>\n\nYour draft is ready and waiting in Drafts > RePosts.`,
        [[{ text: '👁 View Draft', callback_data: `tw_view:${draftId}` }]]
    );

    // Return void — we handled messaging ourselves
    return;
}

/**
 * Rebuild and edit a batch notification message after generating a draft.
 * Finds which page the tweet is on and rebuilds that page.
 */
async function rebuildBatchMessage(env: import('../types').Env, chatId: string, batchMessageId: number): Promise<void> {
    const tweets = await getScoredTweetsByBatchMessage(env, chatId, batchMessageId);
    if (tweets.length === 0) return;

    // Fetch accounts for all tweets
    const accountIds = [...new Set(tweets.map(t => t.account_id))];
    const accounts = new Map<string, import('../types').TwitterAccount>();
    let pageSize = 5;

    for (const accountId of accountIds) {
        const account = await getTwitterAccount(env, accountId, chatId);
        if (account) {
            accounts.set(accountId, account);
            const config = parseTwitterAccountConfig(account);
            pageSize = config.batchPageSize || 5;
        }
    }

    // Always rebuild page 1 (user can navigate to other pages)
    const totalPages = Math.ceil(tweets.length / pageSize);
    const pageItems = tweets.slice(0, pageSize);

    const pageLabel = totalPages > 1 ? ` (1/${totalPages})` : '';
    const lines: string[] = [`🔔 <b>New Tweets Detected</b>${pageLabel}\n`];
    const keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> = [];

    for (const tweet of pageItems) {
        const account = accounts.get(tweet.account_id);
        if (!account) continue;

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

        const row: Array<{ text: string; callback_data?: string; url?: string }> = [];
        if (tweet.draft_id) {
            row.push({ text: `✅ Generated`, callback_data: `noop:${tweet.id}` });
        } else {
            row.push({ text: `⚡ Generate @${account.username}`, callback_data: `action:tw_gen:${tweet.id}` });
        }
        if (tweet.tweet_url) {
            row.push({ text: '🔗 Open', url: tweet.tweet_url });
        }
        keyboard.push(row);
    }

    if (totalPages > 1) {
        lines.push(`<i>${tweets.length} tweets total</i>`);
        keyboard.push([{ text: 'Next ➡️', callback_data: `tw_batch:1` }]);
    }

    await editMessage(env, chatId, batchMessageId, lines.join('\n'), keyboard);
}
