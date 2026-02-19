/**
 * /repost command — Enter manual repost URL input mode
 *
 * If a URL is provided inline (e.g. /repost https://x.com/...), process immediately.
 * Otherwise, prompt the user to send a URL.
 */

import type { HandlerContext } from '../core/router';
import { respond } from '../core/respond';
import { renderRepostPrompt } from '../views/repost';
import { repostUrlInput } from '../inputs/repost-url';

export async function repostCommand(ctx: HandlerContext) {
    if (ctx.args) {
        await repostUrlInput({ ...ctx, text: ctx.args, context: {} });
    } else {
        await respond(ctx.env, ctx.chatId, renderRepostPrompt(), {
            viewName: 'repost',
            context: { awaiting_input: 'repost_url' },
        });
    }
}
