/**
 * /handwrite command — enter compose mode
 *
 * Sends the compose message itself so it can capture the Telegram message ID
 * and store it as statusMessageId for later counter updates.
 */

import type { HandlerContext } from '../core/router';
import type { ViewResult } from '../types';
import { updateChatState } from '../services/db';
import { sendMessage } from '../services/telegram';
import { renderCompose } from '../views';

export async function handwriteCommand(ctx: HandlerContext): Promise<ViewResult | void> {
    const { env, chatId } = ctx;

    const view = renderCompose([], [], false, false);
    const msgId = await sendMessage(env, chatId, view.text, view.keyboard);

    await updateChatState(env, chatId, {
        current_view: 'compose',
        message_id: msgId,
        context: {
            awaiting_input: 'handwrite',
            handwrite: {
                tweets: [],
                imageGen: false,
                aiRefine: false,
                statusMessageId: msgId,
            },
        },
    });

    // Return void — message already sent
}
