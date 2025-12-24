/**
 * Cloudflare Bot - Main Entry Point
 * 
 * Handles Telegram webhook, GitHub webhook, cron triggers, and routing.
 */

import type { Env, TelegramUpdate } from './types';
import { handleMessage } from './handlers/message';
import { handleCallback } from './handlers/callback';
import { handleGitHubWebhook } from './handlers/github-webhook';
import { publishScheduledDrafts } from './handlers/cron';

export default {
    /**
     * HTTP request handler (Telegram webhook, GitHub webhook)
     */
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        // Health check
        if (url.pathname === '/health') {
            return new Response('OK', { status: 200 });
        }

        // Telegram webhook
        if (url.pathname === '/webhook' && request.method === 'POST') {
            return handleTelegramWebhook(request, env);
        }

        // GitHub webhook
        if (url.pathname === '/github-webhook' && request.method === 'POST') {
            return handleGitHubWebhookEndpoint(request, env);
        }

        // Setup webhook (one-time)
        if (url.pathname === '/setup') {
            return setupWebhook(url, env);
        }

        // Migrate database
        if (url.pathname === '/migrate') {
            return migrateDatabase(env);
        }

        // Serve images from R2
        if (url.pathname.startsWith('/image/')) {
            const key = url.pathname.replace('/image/', '');
            const object = await env.IMAGES.get(key);

            if (!object) {
                return new Response('Image not found', { status: 404 });
            }

            const headers = new Headers();
            headers.set('Content-Type', object.httpMetadata?.contentType || 'image/png');
            headers.set('Cache-Control', 'public, max-age=31536000');

            return new Response(object.body, { headers });
        }

        return new Response('Not Found', { status: 404 });
    },

    /**
     * Cron trigger handler (scheduled publishing)
     */
    async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
        console.log('Cron triggered at:', new Date(event.scheduledTime).toISOString());
        await publishScheduledDrafts(env);
    },
};

/**
 * Handle incoming Telegram webhook update
 */
async function handleTelegramWebhook(request: Request, env: Env): Promise<Response> {
    try {
        const update = await request.json() as TelegramUpdate;
        console.log('Received update:', update.update_id);

        if (update.callback_query) {
            // Button click → edit current message
            await handleCallback(env, update.callback_query);
        } else if (update.message?.text) {
            // Text message → send new message
            await handleMessage(env, update.message);
        }

        return new Response('OK', { status: 200 });
    } catch (error) {
        console.error('Webhook error:', error);
        return new Response('OK', { status: 200 }); // Always return 200 to Telegram
    }
}

/**
 * Handle incoming GitHub webhook
 */
async function handleGitHubWebhookEndpoint(request: Request, env: Env): Promise<Response> {
    try {
        const result = await handleGitHubWebhook(env, request);

        if (!result.processed) {
            console.log('GitHub webhook not processed:', result.message);
        }

        return new Response(JSON.stringify(result), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('GitHub webhook error:', error);
        return new Response(JSON.stringify({ error: String(error) }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Setup Telegram webhook (call once after deploy)
 */
async function setupWebhook(url: URL, env: Env): Promise<Response> {
    const webhookUrl = `${url.origin}/webhook`;

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
    return new Response(JSON.stringify({ webhookUrl, result }, null, 2), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}

/**
 * Run database migrations
 */
async function migrateDatabase(env: Env): Promise<Response> {
    try {
        await env.DB.exec(`
      -- Drafts table
      CREATE TABLE IF NOT EXISTS drafts (
        id TEXT PRIMARY KEY,
        pr_number INTEGER NOT NULL,
        pr_title TEXT NOT NULL,
        commit_sha TEXT NOT NULL,
        status TEXT DEFAULT 'draft',
        content TEXT NOT NULL,
        image_url TEXT,
        scheduled_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      -- Chat state for Telegram UI
      CREATE TABLE IF NOT EXISTS chat_state (
        chat_id TEXT PRIMARY KEY,
        message_id INTEGER,
        current_view TEXT DEFAULT 'home',
        context TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
      );

      -- Published posts archive
      CREATE TABLE IF NOT EXISTS published (
        id TEXT PRIMARY KEY,
        draft_id TEXT NOT NULL,
        pr_number INTEGER NOT NULL,
        tweet_ids TEXT NOT NULL,
        tweet_url TEXT,
        image_url TEXT,
        published_at TEXT DEFAULT (datetime('now'))
      );

      -- Watched repos for auto-detection
      CREATE TABLE IF NOT EXISTS repos (
        id TEXT PRIMARY KEY,
        owner TEXT NOT NULL,
        repo TEXT NOT NULL,
        is_watching INTEGER DEFAULT 1,
        config TEXT NOT NULL,
        webhook_id TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(owner, repo)
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_drafts_status ON drafts(status);
      CREATE INDEX IF NOT EXISTS idx_drafts_pr ON drafts(pr_number);
      CREATE INDEX IF NOT EXISTS idx_published_pr ON published(pr_number);
      CREATE INDEX IF NOT EXISTS idx_repos_watching ON repos(is_watching);
    `);

        return new Response(JSON.stringify({ success: true, message: 'Database migrated' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ success: false, error: String(error) }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

