/**
 * Twitter Account Actions — follow, unfollow, delete, bootstrap persona
 */

import type { HandlerContext } from '../core/router';
import type { ViewResult } from '../types';
import { updateChatState, getTwitterAccount, updateTwitterAccount, deleteTwitterAccount } from '../services/db';
import { editMessage } from '../services/telegram';
import { renderAccountDetail, renderAddAccount, renderDeleteAccountConfirm, renderAccountsList } from '../views/accounts';
import { renderError } from '../views';

export async function accountDetailAction(ctx: HandlerContext & { value: string }): Promise<ViewResult> {
    await updateChatState(ctx.env, ctx.chatId, {
        current_view: 'account',
        context: { selected_account_id: ctx.value },
    });
    return renderAccountDetail(ctx.env, ctx.chatId, ctx.value);
}

export async function addAccountAction(ctx: HandlerContext): Promise<ViewResult> {
    await updateChatState(ctx.env, ctx.chatId, {
        current_view: 'add_account',
        context: { awaiting_input: 'add_account' },
    });
    return renderAddAccount();
}

export async function followAction(ctx: HandlerContext & { extra?: string }): Promise<ViewResult> {
    const accountId = ctx.extra!;
    await updateTwitterAccount(ctx.env, accountId, ctx.chatId, { is_watching: 1 });
    return renderAccountDetail(ctx.env, ctx.chatId, accountId);
}

export async function unfollowAction(ctx: HandlerContext & { extra?: string }): Promise<ViewResult> {
    const accountId = ctx.extra!;
    await updateTwitterAccount(ctx.env, accountId, ctx.chatId, { is_watching: 0 });
    return renderAccountDetail(ctx.env, ctx.chatId, accountId);
}

export async function deleteAccountAction(ctx: HandlerContext & { extra?: string }): Promise<ViewResult> {
    const accountId = ctx.extra!;
    return renderDeleteAccountConfirm(ctx.env, ctx.chatId, accountId);
}

export async function confirmDeleteAccountAction(ctx: HandlerContext & { extra?: string }): Promise<ViewResult> {
    const accountId = ctx.extra!;
    const account = await getTwitterAccount(ctx.env, accountId, ctx.chatId);
    if (!account) {
        return renderError('Account not found.');
    }

    await deleteTwitterAccount(ctx.env, accountId, ctx.chatId);
    return {
        text: `✅ <b>Account Deleted</b>\n\n@${account.username} has been removed along with all related data.`,
        keyboard: [[{ text: '👤 Accounts', callback_data: 'view:accounts' }]],
    };
}

export async function bootstrapAction(ctx: HandlerContext & { extra?: string }): Promise<ViewResult> {
    const accountId = ctx.extra!;
    const account = await getTwitterAccount(ctx.env, accountId, ctx.chatId);
    if (!account) {
        return renderError('Account not found.');
    }

    // Show loading state immediately
    await editMessage(
        ctx.env, ctx.chatId, ctx.messageId!,
        `🔄 <b>Analyzing @${account.username}...</b>\n\nSearching the web and building a persona profile. This may take a moment.`,
        [],
    );

    try {
        const { bootstrapPersona } = await import('../services/persona-bootstrap');
        const success = await bootstrapPersona(ctx.env, accountId, ctx.chatId);

        if (success) {
            return renderAccountDetail(ctx.env, ctx.chatId, accountId);
        } else {
            return renderError('Failed to bootstrap persona. Please try again.');
        }
    } catch (error) {
        console.error('[bootstrap] Error:', error);
        return renderError('Persona bootstrap failed. Please try again later.');
    }
}
