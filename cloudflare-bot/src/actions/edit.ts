import type { HandlerContext } from '../core/router';
import type { ViewResult } from '../types';
import { updateChatState } from '../services/db';

export async function editAction(ctx: HandlerContext & { value: string; extra?: string }): Promise<ViewResult> {
    const draftId = ctx.extra!;
    await updateChatState(ctx.env, ctx.chatId, {
        context: { awaiting_input: 'edit_draft', selected_draft_id: draftId },
    });
    return {
        text: `✏️ <b>Edit Draft</b>\n\nWhat changes would you like to make?\n\n<i>Examples:</i>\n• "Make it more casual"\n• "Add more technical details"\n• "Focus on the performance improvements"\n• "Make it shorter"\n\nType your instructions below:`,
        keyboard: [[{ text: '❌ Cancel', callback_data: `draft:${draftId}` }]],
    };
}
