/**
 * Delete draft actions — confirm, execute, cancel
 */

import type { HandlerContext } from '../core/router';
import type { ViewResult } from '../types';
import type { DraftListType } from '../views/drafts';
import { getDraft, deleteDraft, getChatState, parseContext, updateChatState, getTimezone, getPageSize, countDrafts, countDraftsBySource } from '../services/db';
import { deleteMessage, sendMessage } from '../services/telegram';
import { renderDeleteDraftConfirm, renderDraftDetail, renderDraftCategories, renderDraftsList, renderError } from '../views';

export async function deleteDraftAction(
    ctx: HandlerContext & { value: string; extra?: string }
): Promise<ViewResult> {
    const { env, chatId, extra: draftId } = ctx;

    if (!draftId) return renderError('Missing draft ID.');

    const draft = await getDraft(env, draftId, chatId);
    if (!draft) return renderError('Draft not found.');

    return renderDeleteDraftConfirm(draftId, draft.pr_title);
}

export async function confirmDeleteDraftAction(
    ctx: HandlerContext & { value: string; extra?: string }
): Promise<ViewResult | void> {
    const { env, chatId, messageId, extra: draftId } = ctx;

    if (!draftId) return renderError('Missing draft ID.');

    const draft = await getDraft(env, draftId, chatId);
    if (!draft) return renderError('Draft not found.');

    // Read origin list info from chat state before deletion
    const state = await getChatState(env, chatId);
    const context = parseContext(state);
    const listType = context.draft_list_type as DraftListType | undefined;
    const listPage = context.draft_list_page ?? 0;

    // Delete R2 image if exists (best-effort)
    if (draft.image_url) {
        try {
            await env.IMAGES.delete(draft.image_url);
        } catch (err) {
            console.error('R2 image cleanup failed:', err);
        }
    }

    await deleteDraft(env, draftId, chatId);

    // Render the return destination — clamp page in case we deleted the last item on it
    let view: ViewResult;
    let newView: string;
    if (listType) {
        const ps = await getPageSize(env, chatId);
        let total: number;
        if (listType === 'auto') total = await countDraftsBySource(env, chatId, 'auto', ['draft']);
        else if (listType === 'handwrite') total = await countDraftsBySource(env, chatId, 'handwrite', ['draft']);
        else total = await countDrafts(env, chatId, listType as any);
        const totalPages = Math.ceil(total / ps);
        const safePage = totalPages > 0 ? Math.min(listPage, totalPages - 1) : 0;
        view = await renderDraftsList(env, chatId, safePage, listType, ps);
        newView = `drafts_${listType}`;
    } else {
        view = await renderDraftCategories(env, chatId);
        newView = 'drafts';
    }

    // Delete current message (handles photo→text transition) and send new text message
    if (messageId) {
        try {
            await deleteMessage(env, chatId, messageId);
        } catch { /* ignore */ }
    }
    const newMsgId = await sendMessage(env, chatId, view.text, view.keyboard);

    await updateChatState(env, chatId, {
        message_id: newMsgId,
        current_view: newView,
        context: listType ? { page: listPage } : null,
    });

    return; // void — handled sending ourselves
}

export async function cancelDeleteDraftAction(
    ctx: HandlerContext & { value: string; extra?: string }
): Promise<ViewResult> {
    const { env, chatId, extra: draftId } = ctx;

    if (!draftId) return renderError('Missing draft ID.');

    const tz = await getTimezone(env, chatId);
    return renderDraftDetail(env, chatId, draftId, tz);
}
