import type { HandlerContext } from '../core/router';
import type { ViewResult } from '../types';
import { updateDraftStatus } from '../services/db';
import { renderDraftDetail } from '../views';

export async function approveAction(ctx: HandlerContext & { value: string; extra?: string }): Promise<ViewResult> {
    const draftId = ctx.extra!;
    await updateDraftStatus(ctx.env, draftId, ctx.chatId, 'approved');
    return renderDraftDetail(ctx.env, ctx.chatId, draftId);
}
