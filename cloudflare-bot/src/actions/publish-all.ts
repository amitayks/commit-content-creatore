import type { HandlerContext } from '../core/router';
import type { ViewResult } from '../types';
import { getAllDrafts } from '../services/db';
import { publishDraft } from '../core/publish';
import { renderError, renderSuccess } from '../views';

export async function publishAllAction(ctx: HandlerContext & { value: string }): Promise<ViewResult> {
    const { env, chatId } = ctx;
    const drafts = await getAllDrafts(env, chatId, 'approved');

    if (drafts.length === 0) {
        return renderError('No approved drafts to publish.\n\nApprove some drafts first!');
    }

    const results: string[] = [];

    for (const draft of drafts) {
        try {
            const result = await publishDraft(env, chatId, draft);
            results.push(`✅ PR #${draft.pr_number}: ${result.url}`);
        } catch (error) {
            results.push(`❌ PR #${draft.pr_number}: Publishing failed`);
        }
    }

    return renderSuccess(`Published ${results.length} drafts:\n\n${results.join('\n')}`);
}
