import type { HandlerContext } from '../core/router';
import type { ViewResult, DraftContent } from '../types';
import { getDraft, getChatState, parseContext, updateChatState, getTimezone } from '../services/db';
import { ensureImage } from '../services/storage';
import { editMessage, deleteMessage, sendPhoto } from '../services/telegram';
import { renderDraftDetail, renderError } from '../views';
import { truncateHtml } from '../views/drafts';
import { sanitizeError } from '../services/security';

export async function draftDetailAction(ctx: HandlerContext & { value: string }): Promise<ViewResult | void> {
    const { env, chatId, value: draftId, messageId } = ctx;

    const draft = await getDraft(env, draftId, chatId);
    if (!draft) {
        return renderError('Draft not found.');
    }

    let imageUrl: string | null = null;
    // For handwritten drafts, only generate images if the user toggled image gen (imagePrompt exists)
    const shouldEnsureImage = draft.source !== 'handwrite' || (() => {
        try {
            const content = JSON.parse(draft.content) as DraftContent;
            return !!content.imagePrompt;
        } catch { return false; }
    })();
    if (shouldEnsureImage) {
        // Show loading state immediately so the user knows something is happening
        if (messageId) {
            await editMessage(env, chatId, messageId, '⏳ <b>Retrieving your draft...</b>');
        }
        try {
            imageUrl = await ensureImage(env, chatId, draft);
        } catch (imgError) {
            console.error('Image generation failed:', sanitizeError(imgError));
        }
    }

    // Capture origin list info before overwriting state
    const currentState = await getChatState(env, chatId);
    const currentContext = parseContext(currentState);
    let draftListType: string | undefined;
    let draftListPage: number | undefined;
    if (currentState.current_view?.startsWith('drafts_')) {
        draftListType = currentState.current_view.replace('drafts_', '');
        draftListPage = currentContext.page ?? 0;
    }

    const tz = await getTimezone(env, chatId);
    const view = await renderDraftDetail(env, chatId, draftId, tz);

    await updateChatState(env, chatId, {
        current_view: 'draft',
        context: { selected_draft_id: draftId, draft_list_type: draftListType, draft_list_page: draftListPage },
    });

    if (imageUrl && messageId) {
        try {
            await deleteMessage(env, chatId, messageId);
        } catch { /* ignore */ }
        const fullImageUrl = `${env.WORKER_URL}${imageUrl}`;
        const caption = truncateHtml(view.text, 1000);
        await sendPhoto(env, chatId, fullImageUrl, caption, view.keyboard);
        return; // void — handled sending ourselves
    }

    return view; // let router handle editMessage
}
