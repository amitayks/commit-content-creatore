import type { HandlerContext } from '../core/router';
import type { ViewResult } from '../types';
import { getDraft, getTimezone } from '../services/db';
import { publishDraft } from '../core/publish';
import { renderDraftDetail, renderError, renderSuccess } from '../views';

export async function publishAction(ctx: HandlerContext & { value: string; extra?: string }): Promise<ViewResult> {
    const draftId = ctx.extra!;
    const draft = await getDraft(ctx.env, draftId, ctx.chatId);
    if (!draft) {
        return renderError('Draft not found.');
    }

    // Publish — if this fails, the tweet was NOT posted
    let result: { url: string };
    try {
        result = await publishDraft(ctx.env, ctx.chatId, draft);
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('Publish error:', msg);
        return renderError(`Publishing failed:\n\n<code>${msg}</code>`);
    }

    // View rendering is separate — publish already succeeded at this point
    try {
        const tz = await getTimezone(ctx.env, ctx.chatId);
        return await renderDraftDetail(ctx.env, ctx.chatId, draftId, tz);
    } catch {
        return renderSuccess(`Published to X!\n\n${result.url}`);
    }
}
