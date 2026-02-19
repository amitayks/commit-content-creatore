import type { HandlerContext } from '../core/router';
import { respond } from '../core/respond';
import { renderReposList } from '../views';

export async function reposCommand(ctx: HandlerContext) {
	const view = await renderReposList(ctx.env, ctx.chatId);
	await respond(ctx.env, ctx.chatId, view, { viewName: 'repos', context: null });
}
