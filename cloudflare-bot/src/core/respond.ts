/**
 * Respond utility — combines sendMessage/editMessage + updateChatState
 */

import type { Env, ViewResult, ChatContext } from '../types';
import { sendMessage, editMessage } from '../services/telegram';
import { updateChatState } from '../services/db';

export interface RespondOpts {
    /** If true, edit the existing message instead of sending a new one */
    edit?: boolean;
    /** Message ID to edit (required if edit is true) */
    messageId?: number;
    /** View name for chat state (e.g., 'home', 'drafts') */
    viewName?: string;
    /** Context for chat state */
    context?: ChatContext | null;
}

/**
 * Send or edit a Telegram message and update chat state in one call.
 * Returns the message ID.
 */
export async function respond(
    env: Env,
    chatId: string,
    view: ViewResult,
    opts: RespondOpts = {}
): Promise<number> {
    let messageId: number;

    if (opts.edit && opts.messageId) {
        await editMessage(env, chatId, opts.messageId, view.text, view.keyboard);
        messageId = opts.messageId;
    } else {
        messageId = await sendMessage(env, chatId, view.text, view.keyboard);
    }

    if (opts.viewName !== undefined) {
        await updateChatState(env, chatId, {
            message_id: messageId,
            current_view: opts.viewName,
            context: opts.context ?? null,
        });
    }

    return messageId;
}
