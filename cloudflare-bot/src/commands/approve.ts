import type { HandlerContext } from '../core/router';
import { respond } from '../core/respond';
import { getAllDrafts } from '../services/db';
import { publishDraft } from '../core/publish';
import { renderError, renderSuccess, renderPublishing } from '../views';
import { sendMessage } from '../services/telegram';

export async function approveCommand(ctx: HandlerContext) {
	const { env, chatId } = ctx;
	try {
		const drafts = await getAllDrafts(env, chatId, 'approved');

		if (drafts.length === 0) {
			await respond(env, chatId, renderError('No approved drafts to publish.\n\nApprove some drafts first!'));
			return;
		}

		const pubView = renderPublishing(drafts.length);
		await sendMessage(env, chatId, pubView.text, pubView.keyboard);

		const results: string[] = [];

		for (const draft of drafts) {
			try {
				const result = await publishDraft(env, chatId, draft);
				results.push(`✅ PR #${draft.pr_number}: ${result.url}`);
			} catch (error) {
				results.push(`❌ PR #${draft.pr_number}: Publishing failed`);
			}
		}

		await respond(env, chatId, renderSuccess(`Published ${drafts.length} drafts:\n\n${results.join('\n')}`));
	} catch (error) {
		await respond(env, chatId, renderError('Failed to publish. Please try again.'));
	}
}
