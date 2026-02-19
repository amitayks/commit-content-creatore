/**
 * Repost Follow Actions — Follow/no-follow prompt after manual repost generation
 *
 * Handles: rp_follow:USERNAME, rp_no_follow:MSG_ID
 */

import type { ActionHandler } from '../core/router';
import { createTwitterAccount } from '../services/db';
import { editMessage } from '../services/telegram';

/** Follow the account — create twitter account entry */
export const rpFollowAction: ActionHandler = async (ctx) => {
    const username = ctx.value;

    try {
        await createTwitterAccount(ctx.env, ctx.chatId, { username });

        if (ctx.messageId) {
            await editMessage(ctx.env, ctx.chatId, ctx.messageId,
                `✅ Now following <b>@${username}</b>!\n\nYou'll get batch notifications when they post new tweets.`
            );
        }
    } catch (error) {
        console.error('[rp_follow] Failed to follow:', error);
        if (ctx.messageId) {
            await editMessage(ctx.env, ctx.chatId, ctx.messageId,
                `❌ Failed to follow <b>@${username}</b>. They may already be in your accounts.`
            );
        }
    }
    return;
};

/** No follow — dismiss the prompt */
export const rpNoFollowAction: ActionHandler = async (ctx) => {
    if (ctx.messageId) {
        await editMessage(ctx.env, ctx.chatId, ctx.messageId,
            `👋 Got it! You can always follow them later from the Accounts page.`
        );
    }
    return;
};
