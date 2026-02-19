import type { HandlerContext } from '../core/router';
import { respond } from '../core/respond';
import { renderGeneratePrompt } from '../views';
import { commitShaInput } from '../inputs/commit-sha';

export async function generateCommand(ctx: HandlerContext) {
	if (ctx.args) {
		await commitShaInput({ ...ctx, text: ctx.args, context: {} });
	} else {
		await respond(ctx.env, ctx.chatId, renderGeneratePrompt(), {
			viewName: 'generate',
			context: { awaiting_input: 'commit_sha' },
		});
	}
}
