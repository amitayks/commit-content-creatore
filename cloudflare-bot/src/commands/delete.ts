import type { HandlerContext } from '../core/router';
import { respond } from '../core/respond';
import { renderDeletePrompt } from '../views';
import { deleteInput } from '../inputs/delete';

export async function deleteCommand(ctx: HandlerContext) {
	if (ctx.args) {
		await deleteInput({ ...ctx, text: ctx.args, context: {} });
	} else {
		await respond(ctx.env, ctx.chatId, renderDeletePrompt(), {
			viewName: 'delete',
			context: { awaiting_input: 'delete' },
		});
	}
}
