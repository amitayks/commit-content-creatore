import type { HandlerContext } from '../core/router';
import { respond } from '../core/respond';
import { renderDraftCategories } from '../views';

export async function draftsCommand(ctx: HandlerContext) {
	const view = await renderDraftCategories(ctx.env, ctx.chatId);
	await respond(ctx.env, ctx.chatId, view, { viewName: 'drafts', context: null });
}
