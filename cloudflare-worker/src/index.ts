/**
 * Cloudflare Worker - Telegram Webhook Receiver
 * 
 * This worker receives Telegram webhook updates and triggers
 * a GitHub Actions workflow via repository_dispatch.
 * 
 * Deploy to Cloudflare Workers and set the Telegram webhook URL to:
 * https://your-worker.your-subdomain.workers.dev/telegram-webhook
 * 
 * Required environment variables (set in Cloudflare dashboard):
 * - TELEGRAM_BOT_TOKEN: Your Telegram bot token
 * - GITHUB_TOKEN: GitHub PAT with repo scope
 * - GITHUB_REPO: Repository in format "owner/repo"
 * - WEBHOOK_SECRET: Optional secret for additional validation
 */

export interface Env {
    TELEGRAM_BOT_TOKEN: string;
    GITHUB_TOKEN: string;
    GITHUB_REPO: string;
    WEBHOOK_SECRET?: string;
}

interface TelegramUpdate {
    update_id: number;
    message?: {
        text?: string;
        chat?: { id: number };
    };
    callback_query?: {
        id: string;
        data?: string;
    };
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        // Health check endpoint
        if (url.pathname === '/health') {
            return new Response('OK', { status: 200 });
        }

        // Telegram webhook endpoint
        if (url.pathname === '/telegram-webhook' && request.method === 'POST') {
            return handleTelegramWebhook(request, env);
        }

        // Setup endpoint - registers webhook with Telegram
        if (url.pathname === '/setup' && request.method === 'GET') {
            return setupWebhook(url, env);
        }

        return new Response('Not Found', { status: 404 });
    },
};

async function handleTelegramWebhook(request: Request, env: Env): Promise<Response> {
    try {
        const update: TelegramUpdate = await request.json();

        console.log('Received Telegram update:', update.update_id);

        // Trigger GitHub Actions workflow
        const githubResponse = await fetch(
            `https://api.github.com/repos/${env.GITHUB_REPO}/dispatches`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
                    Accept: 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'telegram-webhook-worker',
                },
                body: JSON.stringify({
                    event_type: 'telegram_update',
                    client_payload: {
                        update: JSON.stringify(update),
                    },
                }),
            }
        );

        if (!githubResponse.ok) {
            const error = await githubResponse.text();
            console.error('GitHub API error:', githubResponse.status, error);

            // Still return OK to Telegram to prevent retries
            return new Response('OK', { status: 200 });
        }

        console.log('Successfully triggered GitHub workflow');
        return new Response('OK', { status: 200 });
    } catch (error) {
        console.error('Error processing webhook:', error);
        // Return OK to prevent Telegram from retrying
        return new Response('OK', { status: 200 });
    }
}

async function setupWebhook(url: URL, env: Env): Promise<Response> {
    const webhookUrl = `${url.origin}/telegram-webhook`;

    const response = await fetch(
        `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: webhookUrl,
                allowed_updates: ['message', 'callback_query'],
            }),
        }
    );

    const result = await response.json();

    return new Response(
        JSON.stringify({
            success: true,
            webhook_url: webhookUrl,
            telegram_response: result,
        }),
        {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }
    );
}
