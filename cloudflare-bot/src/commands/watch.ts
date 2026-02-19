import type { HandlerContext } from '../core/router';
import { respond } from '../core/respond';
import { renderAddRepo } from '../views';
import { addRepoInput } from '../inputs/add-repo';

export async function watchCommand(ctx: HandlerContext) {
	if (ctx.args) {
		await addRepoInput({ ...ctx, text: ctx.args, context: {} });
	} else {
		await respond(ctx.env, ctx.chatId, renderAddRepo(), {
			viewName: 'add_repo',
			context: { awaiting_input: 'add_repo' },
		});
	}
}
