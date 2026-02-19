/**
 * Settings Key Management — show API keys status and prompt for updates
 */

import type { HandlerContext } from '../core/router';
import type { ViewResult } from '../types';
import { getUser } from '../services/user-db';
import { updateChatState } from '../services/db';
import { renderApiKeys } from '../views/settings';

export async function settingsKeysAction(
    ctx: HandlerContext & { value: string; extra?: string }
): Promise<ViewResult | void> {
    const { env, chatId, value, extra } = ctx;

    if (value === 'keys') {
        const user = await getUser(env, chatId);
        await updateChatState(env, chatId, { current_view: 'api_keys', context: null });
        return renderApiKeys({
            hasGemini: user?.has_gemini === 1,
            hasX: user?.has_x === 1,
            hasGitHub: user?.has_github === 1,
            hasInstagram: user?.has_instagram === 1,
        });
    }

    if (value === 'update') {
        const service = extra;

        if (service === 'gemini') {
            await updateChatState(env, chatId, {
                current_view: 'api_keys',
                context: { awaiting_input: 'update_key', key_service: 'gemini' },
            });
            return {
                text: '🔑 <b>Update Gemini API Key</b>\n\nPaste your new Gemini API key below:\n\n<i>(Message will be deleted after saving)</i>',
                keyboard: [
                    [{ text: '📖 Get key', url: 'https://aistudio.google.com/apikey' }],
                    [{ text: '◀️ Cancel', callback_data: 'settings:keys' }],
                ],
            };
        }

        if (service === 'x') {
            await updateChatState(env, chatId, {
                current_view: 'api_keys',
                context: { awaiting_input: 'update_key', key_service: 'x' },
            });
            return {
                text: '🔑 <b>Update X/Twitter Keys</b>\n\n<b>Send 4 values, one per line:</b>\n\n<code>API_KEY</code>\n<code>API_SECRET</code>\n<code>ACCESS_TOKEN</code>\n<code>ACCESS_SECRET</code>\n\n<i>(Message will be deleted after saving)</i>',
                keyboard: [
                    [{ text: '📖 Developer portal', url: 'https://developer.x.com/en/portal/dashboard' }],
                    [{ text: '◀️ Cancel', callback_data: 'settings:keys' }],
                ],
            };
        }

        if (service === 'github') {
            await updateChatState(env, chatId, {
                current_view: 'api_keys',
                context: { awaiting_input: 'update_key', key_service: 'github' },
            });
            return {
                text: '🔑 <b>Update GitHub Token</b>\n\nPaste your personal access token below:\n\n<i>(Message will be deleted after saving)</i>',
                keyboard: [
                    [{ text: '📖 Create token', url: 'https://github.com/settings/tokens' }],
                    [{ text: '◀️ Cancel', callback_data: 'settings:keys' }],
                ],
            };
        }

        if (service === 'instagram') {
            await updateChatState(env, chatId, {
                current_view: 'api_keys',
                context: { awaiting_input: 'update_key', key_service: 'instagram' },
            });
            return {
                text: '🔑 <b>Update Instagram Credentials</b>\n\n<b>Send 2 values, one per line:</b>\n\n<code>ACCESS_TOKEN</code>\n<code>BUSINESS_ACCOUNT_ID</code>\n\n<i>(Message will be deleted after saving)</i>',
                keyboard: [
                    [{ text: '📖 Meta developers', url: 'https://developers.facebook.com/' }],
                    [{ text: '◀️ Cancel', callback_data: 'settings:keys' }],
                ],
            };
        }
    }
}
