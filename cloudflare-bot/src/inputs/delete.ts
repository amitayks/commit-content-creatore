import type { HandlerContext } from '../core/router';
import type { ChatContext } from '../types';
import { respond } from '../core/respond';
import { updateChatState } from '../services/db';
import { renderError } from '../views';

export async function deleteInput(ctx: HandlerContext & { text: string; context: ChatContext }) {
    const { env, chatId } = ctx;
    await updateChatState(env, chatId, { context: null });
    await respond(env, chatId, renderError('Delete functionality coming soon.'));
}
