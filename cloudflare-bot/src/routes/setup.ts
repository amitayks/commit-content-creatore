import type { Env } from '../types';
import { verifyAdminSecret, secureJsonResponse, secureErrorResponse } from '../services/security';
import { setMyCommands } from '../services/telegram';

export async function handleSetup(request: Request, url: URL, env: Env): Promise<Response> {
    if (!await verifyAdminSecret(request, env)) {
        return secureJsonResponse({ error: 'Unauthorized' }, 401);
    }

    const webhookUrl = `${url.origin}/webhook`;

    try {
        const response = await fetch(
            `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: webhookUrl,
                    allowed_updates: ['message', 'edited_message', 'callback_query'],
                }),
            }
        );

        const result = await response.json();

        // Register bot commands for / autocomplete
        await setMyCommands(env);

        return secureJsonResponse({ webhookUrl, result, commands: 'registered' });
    } catch (error) {
        return secureErrorResponse(error);
    }
}
