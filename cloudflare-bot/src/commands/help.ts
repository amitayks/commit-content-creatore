import type { HandlerContext } from '../core/router';
import { respond } from '../core/respond';
import { renderHelp } from '../views';

export async function helpCommand(ctx: HandlerContext) {
	await respond(ctx.env, ctx.chatId, renderHelp(), { viewName: 'help', context: null });
}
