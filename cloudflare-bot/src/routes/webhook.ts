import type { Env, TelegramUpdate } from '../types';
import { handleMessage } from '../handlers/message';
import { handleCallback } from '../handlers/callback';
import {
    getUserIdFromUpdate,
    getUserAuthState,
    addSecurityHeaders,
    sanitizeError,
    parseJsonBody,
    logInfo,
    logError,
} from '../services/security';
import { sendMessage, answerCallback } from '../services/telegram';
import { createUser, getUserCount } from '../services/user-db';
import { hydrateEnv } from '../services/user-keys';
import { handleOnboardingMessage, handleOnboardingCallback } from '../commands/onboarding';

export async function handleTelegramWebhook(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
    try {
        const update = await parseJsonBody<TelegramUpdate>(request, 64 * 1024);
        if (!update) {
            return addSecurityHeaders(new Response('OK', { status: 200 }));
        }

        const userId = getUserIdFromUpdate(update);
        if (userId === null) {
            return addSecurityHeaders(new Response('OK', { status: 200 }));
        }

        const chatId = String(userId);
        logInfo('Processing update:', update.update_id, 'for user:', userId);

        // Check user auth state
        const { state, user } = await getUserAuthState(userId, env);

        // Unregistered user — create user row and start onboarding
        if (state === 'unregistered') {
            // Check max users cap
            const maxUsers = parseInt(env.MAX_USERS || '50', 10);
            const currentCount = await getUserCount(env);
            if (currentCount >= maxUsers) {
                const targetChatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
                if (targetChatId) {
                    try {
                        await sendMessage(env, targetChatId, `✋ Muse is currently invite-only.\n\nInterested in getting access? Reach out to @amitayks on Telegram.`);
                    } catch { }
                }
                return addSecurityHeaders(new Response('OK', { status: 200 }));
            }

            const from = update.message?.from || update.callback_query?.from;
            const username = (from as any)?.username || null;
            const displayName = from?.first_name || null;
            await createUser(env, chatId, username, displayName);

            const targetChatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
            if (targetChatId) {
                await handleOnboardingMessage(env, chatId, targetChatId, update);
            }
            return addSecurityHeaders(new Response('OK', { status: 200 }));
        }

        // Suspended user
        if (state === 'suspended') {
            const targetChatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
            if (targetChatId) {
                try {
                    await sendMessage(env, targetChatId, 'Your account has been suspended. Please contact the bot administrator.');
                } catch { }
            }
            if (update.callback_query?.id) {
                try { await answerCallback(env, update.callback_query.id, 'Account suspended'); } catch { }
            }
            return addSecurityHeaders(new Response('OK', { status: 200 }));
        }

        // Onboarding user — route to onboarding handler
        if (state === 'onboarding') {
            const targetChatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
            if (update.callback_query) {
                await handleOnboardingCallback(env, chatId, update.callback_query);
            } else if (targetChatId) {
                await handleOnboardingMessage(env, chatId, targetChatId, update);
            }
            return addSecurityHeaders(new Response('OK', { status: 200 }));
        }

        // Active user — hydrate env with their keys and proceed normally
        let hydratedEnv: Env;
        try {
            hydratedEnv = await hydrateEnv(env, chatId);
        } catch (keyError) {
            logError('Key hydration failed for user:', chatId, sanitizeError(keyError));
            const targetChatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
            if (targetChatId) {
                try {
                    await sendMessage(env, targetChatId, 'Error loading your API keys. Please update them in Settings > API Keys.');
                } catch { }
            }
            return addSecurityHeaders(new Response('OK', { status: 200 }));
        }

        if (update.callback_query) {
            await handleCallback(hydratedEnv, update.callback_query, ctx);
        } else if (update.edited_message) {
            await handleMessage(hydratedEnv, update.edited_message, true);
        } else if (update.message) {
            await handleMessage(hydratedEnv, update.message);
        }

        return addSecurityHeaders(new Response('OK', { status: 200 }));
    } catch (error) {
        logError('Webhook error:', sanitizeError(error));
        return addSecurityHeaders(new Response('OK', { status: 200 }));
    }
}
