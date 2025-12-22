/**
 * Cloudflare Worker - Interactive Telegram Bot
 * 
 * Edge-optimized bot with instant responses using D1 database.
 */

import { getChatState, updateChatState, updateDraftStatus } from './services/database';
import { sendMessage, editMessage, answerCallback, type TelegramUpdate } from './services/telegram';
import { renderHome, renderDraftsList, renderDraft, renderStats, renderHelp, renderGenerate } from './views/index';

export interface Env {
    TELEGRAM_BOT_TOKEN: string;
    TELEGRAM_CHAT_ID: string;
    GITHUB_TOKEN: string;
    GITHUB_REPO: string;
    DB: D1Database;
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        // Health check
        if (url.pathname === '/health') {
            return new Response('OK', { status: 200 });
        }

        // Telegram webhook
        if (url.pathname === '/telegram-webhook' && request.method === 'POST') {
            return handleTelegramWebhook(request, env);
        }

        // Setup webhook
        if (url.pathname === '/setup') {
            return setupWebhook(url, env);
        }

        // Migrate database
        if (url.pathname === '/migrate') {
            return migrateDatabase(env);
        }

        return new Response('Not Found', { status: 404 });
    },
};

/**
 * Handle Telegram webhook updates.
 */
async function handleTelegramWebhook(request: Request, env: Env): Promise<Response> {
    try {
        const update: TelegramUpdate = await request.json();
        console.log('Received update:', update.update_id);

        if (update.callback_query) {
            await handleCallback(env, update.callback_query);
        } else if (update.message?.text) {
            await handleMessage(env, update.message);
        }

        return new Response('OK', { status: 200 });
    } catch (error) {
        console.error('Error handling webhook:', error);
        return new Response('OK', { status: 200 });
    }
}

/**
 * Handle text messages.
 */
async function handleMessage(
    env: Env,
    message: { chat: { id: number }; text?: string }
): Promise<void> {
    const chatId = String(message.chat.id);
    const text = message.text || '';

    // Get or create chat state
    const state = await getChatState(env, chatId);

    // Check for awaiting input
    if (state.awaiting_input === 'commit_sha') {
        // Handle commit SHA input
        await updateChatState(env, chatId, { awaiting_input: null });
        await triggerGeneration(env, chatId, text.trim(), state.dashboard_message_id);
        return;
    }

    // Any message shows/updates the dashboard
    const { text: content, keyboard } = await renderHome(env);

    if (state.dashboard_message_id) {
        // Update existing dashboard
        try {
            await editMessage(env, chatId, state.dashboard_message_id, content, keyboard);
        } catch {
            // Message might be too old, send new one
            const messageId = await sendMessage(env, chatId, content, keyboard);
            await updateChatState(env, chatId, { dashboard_message_id: messageId, current_view: 'home' });
        }
    } else {
        // Send new dashboard
        const messageId = await sendMessage(env, chatId, content, keyboard);
        await updateChatState(env, chatId, { dashboard_message_id: messageId, current_view: 'home' });
    }
}

/**
 * Handle button callbacks.
 */
async function handleCallback(
    env: Env,
    callback: { id: string; message?: { chat: { id: number }; message_id: number }; data?: string }
): Promise<void> {
    if (!callback.message || !callback.data) return;

    const chatId = String(callback.message.chat.id);
    const messageId = callback.message.message_id;
    const data = callback.data;

    // Parse callback data: type:value
    const [type, value, extra] = data.split(':');

    let response: { text: string; keyboard: { text: string; callback_data: string }[][] };

    switch (type) {
        case 'view':
            response = await handleViewChange(env, value, chatId);
            await updateChatState(env, chatId, { current_view: value });
            break;

        case 'draft':
            response = await renderDraft(env, value);
            await updateChatState(env, chatId, { current_view: 'draft', selected_draft_id: value });
            break;

        case 'action':
            response = await handleAction(env, value, extra, chatId);
            break;

        default:
            response = await renderHome(env);
    }

    await editMessage(env, chatId, messageId, response.text, response.keyboard);
    await answerCallback(env, callback.id);
}

/**
 * Handle view changes.
 */
async function handleViewChange(
    env: Env,
    view: string,
    chatId: string
): Promise<{ text: string; keyboard: { text: string; callback_data: string }[][] }> {
    switch (view) {
        case 'home':
            return renderHome(env);
        case 'drafts':
            return renderDraftsList(env);
        case 'stats':
            return renderStats(env);
        case 'help':
            return renderHelp();
        case 'generate':
            await updateChatState(env, chatId, { awaiting_input: 'commit_sha' });
            return renderGenerate();
        default:
            return renderHome(env);
    }
}

/**
 * Handle actions (approve, reject, regenerate).
 */
async function handleAction(
    env: Env,
    action: string,
    draftId: string,
    chatId: string
): Promise<{ text: string; keyboard: { text: string; callback_data: string }[][] }> {
    switch (action) {
        case 'approve':
            await updateDraftStatus(env, draftId, 'approved');
            return {
                text: `✅ <b>Draft Approved!</b>\n\n📌 Use /publish to post to X now\n⏰ Or it will auto-publish within 4 hours`,
                keyboard: [[{ text: '◀️ Back to Drafts', callback_data: 'view:drafts' }]],
            };

        case 'reject':
            await updateDraftStatus(env, draftId, 'rejected');
            return {
                text: `❌ <b>Draft Rejected</b>\n\nThe draft has been discarded.`,
                keyboard: [[{ text: '◀️ Back to Drafts', callback_data: 'view:drafts' }]],
            };

        case 'regenerate':
            await triggerRegeneration(env, chatId, draftId);
            return {
                text: `🔄 <b>Regenerating...</b>\n\nThis may take a minute. You'll see the updated draft when ready.`,
                keyboard: [[{ text: '◀️ Back to Drafts', callback_data: 'view:drafts' }]],
            };

        default:
            return renderHome(env);
    }
}

/**
 * Trigger content generation via GitHub Actions.
 */
async function triggerGeneration(
    env: Env,
    chatId: string,
    commitSha: string,
    dashboardMessageId: number | null
): Promise<void> {
    try {
        await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/dispatches`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${env.GITHUB_TOKEN}`,
                Accept: 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                event_type: 'generate_content',
                client_payload: { commit_sha: commitSha },
            }),
        });

        if (dashboardMessageId) {
            await editMessage(
                env,
                chatId,
                dashboardMessageId,
                `🚀 <b>Generating content...</b>\n\nCommit: <code>${commitSha}</code>\n\nThis may take a minute. You'll be notified when ready.`,
                [[{ text: '◀️ Back', callback_data: 'view:home' }]]
            );
        }
    } catch (error) {
        console.error('Failed to trigger generation:', error);
    }
}

/**
 * Trigger regeneration via GitHub Actions.
 */
async function triggerRegeneration(env: Env, chatId: string, draftId: string): Promise<void> {
    try {
        await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/dispatches`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${env.GITHUB_TOKEN}`,
                Accept: 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                event_type: 'regenerate_content',
                client_payload: { draft_id: draftId },
            }),
        });
    } catch (error) {
        console.error('Failed to trigger regeneration:', error);
    }
}

/**
 * Setup Telegram webhook.
 */
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

    return new Response(JSON.stringify({ success: true, webhook_url: webhookUrl, result }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}

/**
 * Run database migrations.
 */
async function migrateDatabase(env: Env): Promise<Response> {
    try {
        // Create tables
        await env.DB.exec(`
      CREATE TABLE IF NOT EXISTS drafts (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        status TEXT DEFAULT 'draft',
        content TEXT NOT NULL,
        source TEXT NOT NULL,
        telegram_message_id INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS chat_state (
        chat_id TEXT PRIMARY KEY,
        dashboard_message_id INTEGER,
        current_view TEXT DEFAULT 'home',
        selected_draft_id TEXT,
        awaiting_input TEXT,
        context TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS published (
        id TEXT PRIMARY KEY,
        draft_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        tweet_ids TEXT NOT NULL,
        tweet_url TEXT,
        published_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_drafts_status ON drafts(status);
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
