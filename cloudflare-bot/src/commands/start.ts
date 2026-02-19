import type { HandlerContext } from '../core/router';
import { respond } from '../core/respond';
import { renderHome } from '../views';

export async function startCommand(ctx: HandlerContext) {
	await respond(ctx.env, ctx.chatId, await renderHome(ctx.env, ctx.chatId), { viewName: 'home', context: null });
}
