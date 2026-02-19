import type { HandlerContext } from '../core/router';
import type { ChatContext, InlineButton } from '../types';
import { respond } from '../core/respond';
import { updateChatState, getDraft, updateDraftContent } from '../services/db';
import { editContent } from '../services/gemini';
import { sendMessage, editMessage } from '../services/telegram';
import { renderError } from '../views';
import { sanitizeError } from '../services/security';
import type { DraftContent } from '../types';

export async function editDraftInput(ctx: HandlerContext & { text: string; context: ChatContext }) {
    const { env, chatId, text: instruction, context } = ctx;

    const draftId = context.selected_draft_id;
    if (!draftId) {
        await updateChatState(env, chatId, { context: null });
        await respond(env, chatId, renderError('No draft selected for editing.'));
        return;
    }

    try {
        const draft = await getDraft(env, draftId, chatId);
        if (!draft) {
            await updateChatState(env, chatId, { context: null });
            await respond(env, chatId, renderError('Draft not found.'));
            return;
        }

        const currentContent = JSON.parse(draft.content) as DraftContent;

        const editingView = {
            text: `✏️ <b>Editing draft...</b>\n\nApplying: "<i>${instruction}</i>"`,
            keyboard: [] as InlineButton[][],
        };
        const messageId = await sendMessage(env, chatId, editingView.text);

        const refinedContent = await editContent(env, currentContent, instruction);

        await updateDraftContent(env, draftId, chatId, JSON.stringify(refinedContent));
        await updateChatState(env, chatId, { context: null });

        await editMessage(env, chatId, messageId,
            `✅ <b>Draft updated!</b>\n\nApplied: "<i>${instruction}</i>"`,
            [[{ text: '👀 View Draft', callback_data: `draft:${draftId}` }]]
        );
    } catch (error) {
        console.error('Edit draft error:', sanitizeError(error));
        // Keep awaiting_input so user can retry with a different instruction
        await sendMessage(env, chatId,
            `❌ <b>Edit failed</b>\n\nCouldn't apply that change. Send another instruction to try again.`,
            [[{ text: '❌ Cancel', callback_data: `draft:${draftId}` }]]
        );
    }
}
