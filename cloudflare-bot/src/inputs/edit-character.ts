/**
 * Edit character input handler — receives personality text for a character
 */

import type { HandlerContext } from '../core/router';
import type { ChatContext } from '../types';
import { handleCharacterEditInput } from '../actions/video-settings';
import { respond } from '../core/respond';

export async function editCharacterInput(
    ctx: HandlerContext & { text: string; context: ChatContext }
): Promise<void> {
    const view = await handleCharacterEditInput({ ...ctx, text: ctx.text });
    if (view) {
        await respond(ctx.env, ctx.chatId, view, { viewName: 'video_settings', context: null });
    }
}
