/**
 * Tweet View Draft Action — Handler for tw_view:DRAFT_ID
 *
 * Called when user clicks [View Draft] on the "draft ready" notification.
 * Edits the message to show "Retrieving..." then updates with the full
 * draft detail (with image if available).
 */

import type { ActionHandler } from '../core/router';
import type { DraftContent } from '../types';
import { getDraft, getTimezone } from '../services/db';
import { editMessage, sendPhoto, deleteMessage } from '../services/telegram';
import { ensureImage } from '../services/storage';
import { renderDraftDetail, renderError } from '../views';
import { truncateHtml } from '../views/drafts';

export const tweetViewDraftAction: ActionHandler = async (ctx) => {
    const draftId = ctx.value;
    const messageId = ctx.messageId;

    if (!messageId) {
        return renderError('Message context lost.');
    }

    // Show loading state
    await editMessage(ctx.env, ctx.chatId, messageId,
        '⏳ <b>Retrieving your draft...</b>',
        []
    );

    const draft = await getDraft(ctx.env, draftId, ctx.chatId);
    if (!draft) {
        await editMessage(ctx.env, ctx.chatId, messageId,
            '❌ Draft not found. It may have been deleted.',
            [[{ text: '🏠 Home', callback_data: 'view:home' }]]
        );
        return;
    }

    // Try to generate/fetch image
    let imageUrl: string | null = null;
    try {
        const content = JSON.parse(draft.content) as DraftContent;
        // Only generate image if it has an imagePrompt or is not handwritten
        if (draft.source !== 'handwrite' || content.imagePrompt) {
            imageUrl = await ensureImage(ctx.env, ctx.chatId, draft);
        }
    } catch (error) {
        console.error('[tw_view] Image generation failed:', error);
    }

    const tz = await getTimezone(ctx.env, ctx.chatId);
    const view = await renderDraftDetail(ctx.env, ctx.chatId, draftId, tz);

    if (imageUrl) {
        // Delete the text message and send as photo with caption
        try {
            await deleteMessage(ctx.env, ctx.chatId, messageId);
        } catch { /* ignore */ }

        const fullImageUrl = `${ctx.env.WORKER_URL}${imageUrl}`;
        const caption = truncateHtml(view.text, 1000);
        await sendPhoto(ctx.env, ctx.chatId, fullImageUrl, caption, view.keyboard);
        return; // void — handled sending ourselves
    }

    // No image — just edit the message with draft detail
    await editMessage(ctx.env, ctx.chatId, messageId, view.text, view.keyboard);
};
