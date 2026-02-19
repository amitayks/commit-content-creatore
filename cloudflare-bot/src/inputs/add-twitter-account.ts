/**
 * Add Twitter Account Input Handler
 *
 * Processes @username input when awaiting_input='add_account'.
 * Validates the username via X API lookup, creates the account record.
 */

import type { HandlerContext, InputHandler } from '../core/router';
import type { ChatContext } from '../types';
import { createTwitterAccount, updateChatState } from '../services/db';
import { renderAccountsList } from '../views/accounts';
import { sendMessage } from '../services/telegram';
import { respond } from '../core/respond';

export const addTwitterAccountInput: InputHandler = async (
    ctx: HandlerContext & { text: string; context: ChatContext }
) => {
    const { env, chatId } = ctx;
    const username = ctx.text.trim().replace(/^@/, '');

    if (!username || username.length < 1 || username.length > 15 || !/^[a-zA-Z0-9_]+$/.test(username)) {
        await sendMessage(env, chatId,
            `❌ <b>Invalid username</b>\n\n"${username}" doesn't look like a valid Twitter/X username.\n\nUsernames must be 1-15 characters, alphanumeric or underscore only.\n\nTry again:`,
            [[{ text: '❌ Cancel', callback_data: 'view:accounts' }]]
        );
        return;
    }

    try {
        // Try to look up the user via X API
        const { lookupUserByUsername } = await import('../services/x');
        let userId: string | undefined;
        let displayName: string | undefined;

        try {
            const user = await lookupUserByUsername(env, username);
            if (user) {
                userId = user.id;
                displayName = user.name;
            }
        } catch (error) {
            console.error('[add-account] X API lookup failed:', error);
            // Continue without user_id — poller will resolve later
        }

        const accountId = await createTwitterAccount(env, chatId, {
            username: username.toLowerCase(),
            user_id: userId,
            display_name: displayName,
        });

        // Clear awaiting_input and show accounts list
        await updateChatState(env, chatId, {
            current_view: 'accounts',
            context: null,
        });

        const view = await renderAccountsList(env, chatId);
        await respond(env, chatId, view, { viewName: 'accounts', context: null });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('UNIQUE constraint')) {
            await sendMessage(env, chatId,
                `❌ <b>Already following</b>\n\nYou're already following @${username}.`,
                [[{ text: '👤 Accounts', callback_data: 'view:accounts' }]]
            );
            return;
        }
        console.error('[add-account] Error:', error);
        await sendMessage(env, chatId,
            `❌ Failed to add account. Please try again.`,
            [[{ text: '🏠 Home', callback_data: 'view:home' }]]
        );
    }
};
