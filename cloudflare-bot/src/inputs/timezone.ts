import type { HandlerContext } from '../core/router';
import type { ChatContext } from '../types';
import { setTimezone, getTimezone, getPageSize, updateChatState } from '../services/db';
import { respond } from '../core/respond';
import { renderSettings } from '../views/settings';
import { isValidTimezone } from '../services/timezone';
import { sendMessage } from '../services/telegram';

export async function timezoneInput(ctx: HandlerContext & { text: string; context: ChatContext }) {
    const { env, chatId, text: input } = ctx;

    const tz = input.trim().toUpperCase();

    if (!isValidTimezone(tz)) {
        await sendMessage(env, chatId,
            `❌ Invalid format.\n\nPlease use UTC offset format:\n<code>UTC+2</code>, <code>UTC-5:30</code>, <code>UTC</code>\n\nTry again or cancel.`,
            [[{ text: '❌ Cancel', callback_data: 'view:settings' }]]
        );
        return;
    }

    await setTimezone(env, chatId, tz);
    await updateChatState(env, chatId, { current_view: 'settings', context: null });

    const savedTz = await getTimezone(env, chatId);
    const ps = await getPageSize(env, chatId);
    const view = renderSettings(savedTz, ps);
    await respond(env, chatId, view, { viewName: 'settings', context: null });
}
