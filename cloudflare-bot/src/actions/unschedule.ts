import type { HandlerContext } from '../core/router';
import type { ViewResult } from '../types';
import { updateDraftStatus } from '../services/db';
import { renderSuccess } from '../views';

export async function unscheduleAction(ctx: HandlerContext & { value: string; extra?: string }): Promise<ViewResult> {
    const draftId = ctx.extra!;
    await updateDraftStatus(ctx.env, draftId, ctx.chatId, 'draft');
    return renderSuccess('Schedule cancelled. Draft returned to pending status.');
}
