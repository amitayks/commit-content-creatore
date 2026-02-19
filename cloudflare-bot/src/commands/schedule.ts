import type { HandlerContext } from '../core/router';
import { respond } from '../core/respond';
import { renderSchedulePrompt } from '../views';
import { scheduleInput } from '../inputs/schedule';

export async function scheduleCommand(ctx: HandlerContext) {
	if (ctx.args) {
		await scheduleInput({ ...ctx, text: ctx.args, context: {} });
	} else {
		await respond(ctx.env, ctx.chatId, renderSchedulePrompt(), {
			viewName: 'schedule',
			context: { awaiting_input: 'schedule' },
		});
	}
}
