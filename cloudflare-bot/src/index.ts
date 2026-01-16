/**
 * Cloudflare Bot - Main Entry Point
 *
 * Handles Telegram webhook, GitHub webhook, cron triggers, and routing.
 * Implements comprehensive security: authorization, validation, and headers.
 */

import type { Env, TelegramUpdate } from './types';
import { handleMessage } from './handlers/message';
import { handleCallback } from './handlers/callback';
import { handleGitHubWebhook } from './handlers/github-webhook';
import { publishScheduledDrafts } from './handlers/cron';
import {
    getUserIdFromUpdate,
    isAuthorizedUser,
    verifyAdminSecret,
    validateR2Key,
    verifySignedImageUrl,
    addSecurityHeaders,
    secureJsonResponse,
    secureErrorResponse,
    sanitizeError,
    parseJsonBody,
    checkRateLimit,
    rateLimitResponse,
    addRateLimitHeaders,
    RATE_LIMITS,
    logInfo,
    logError,
} from './services/security';
import { sendMessage, answerCallback } from './services/telegram';

export default {
    /**
     * HTTP request handler (Telegram webhook, GitHub webhook)
     */
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        // Get client IP for rate limiting (Cloudflare provides this)
        const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';

        try {
            // Health check (public, no rate limit)
            if (url.pathname === '/health') {
                return addSecurityHeaders(new Response('OK', { status: 200 }));
            }

            // Telegram webhook with rate limiting
            if (url.pathname === '/webhook' && request.method === 'POST') {
                const rateLimit = checkRateLimit(`webhook:${clientIP}`, RATE_LIMITS.webhook);
                if (!rateLimit.allowed) {
                    return rateLimitResponse(rateLimit.resetAt, RATE_LIMITS.webhook.maxRequests);
                }
                const response = await handleTelegramWebhook(request, env);
                return addRateLimitHeaders(response, rateLimit.remaining, rateLimit.resetAt, RATE_LIMITS.webhook.maxRequests);
            }

            // GitHub webhook with rate limiting
            if (url.pathname === '/github-webhook' && request.method === 'POST') {
                const rateLimit = checkRateLimit(`github:${clientIP}`, RATE_LIMITS.github);
                if (!rateLimit.allowed) {
                    return rateLimitResponse(rateLimit.resetAt, RATE_LIMITS.github.maxRequests);
                }
                const response = await handleGitHubWebhookEndpoint(request, env);
                return addRateLimitHeaders(response, rateLimit.remaining, rateLimit.resetAt, RATE_LIMITS.github.maxRequests);
            }

            // Setup webhook (protected) with strict rate limiting
            if (url.pathname === '/setup') {
                const rateLimit = checkRateLimit(`admin:${clientIP}`, RATE_LIMITS.admin);
                if (!rateLimit.allowed) {
                    return rateLimitResponse(rateLimit.resetAt, RATE_LIMITS.admin.maxRequests);
                }
                const response = await handleProtectedSetup(request, url, env);
                return addRateLimitHeaders(response, rateLimit.remaining, rateLimit.resetAt, RATE_LIMITS.admin.maxRequests);
            }

            // Migrate database (protected) with strict rate limiting
            if (url.pathname === '/migrate') {
                const rateLimit = checkRateLimit(`admin:${clientIP}`, RATE_LIMITS.admin);
                if (!rateLimit.allowed) {
                    return rateLimitResponse(rateLimit.resetAt, RATE_LIMITS.admin.maxRequests);
                }
                const response = await handleProtectedMigrate(request, env);
                return addRateLimitHeaders(response, rateLimit.remaining, rateLimit.resetAt, RATE_LIMITS.admin.maxRequests);
            }

            // Serve images from R2 with rate limiting
            if (url.pathname.startsWith('/image/')) {
                const rateLimit = checkRateLimit(`image:${clientIP}`, RATE_LIMITS.image);
                if (!rateLimit.allowed) {
                    return rateLimitResponse(rateLimit.resetAt, RATE_LIMITS.image.maxRequests);
                }
                const response = await handleImageRequest(url, env);
                return addRateLimitHeaders(response, rateLimit.remaining, rateLimit.resetAt, RATE_LIMITS.image.maxRequests);
            }

            // Unknown route - return 404 without info leakage
            return addSecurityHeaders(new Response('Not Found', { status: 404 }));
        } catch (error) {
            logError('Unhandled error:', error);
            return secureErrorResponse(error);
        }
    },

    /**
     * Cron trigger handler (scheduled publishing)
     */
    async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
        logInfo('Cron triggered at:', new Date(event.scheduledTime).toISOString());
        try {
            await publishScheduledDrafts(env);
        } catch (error) {
            logError('Cron error:', sanitizeError(error));
        }
    },
};

/**
 * Handle incoming Telegram webhook update with authorization
 */
async function handleTelegramWebhook(request: Request, env: Env): Promise<Response> {
    try {
        // Parse and validate JSON body
        const update = await parseJsonBody<TelegramUpdate>(request, 64 * 1024); // 64KB limit
        if (!update) {
            return addSecurityHeaders(new Response('OK', { status: 200 }));
        }

        // SECURITY: Extract and validate user ID
        const userId = getUserIdFromUpdate(update);

        // SECURITY: Authorization check - reject unauthorized users
        if (!isAuthorizedUser(userId, env)) {
            logInfo('Unauthorized Telegram user attempted access:', userId);

            // Send rejection message for messages
            if (update.message?.chat?.id) {
                try {
                    await sendMessage(
                        env,
                        update.message.chat.id,
                        'Sorry, this bot is not available for public use.'
                    );
                } catch {
                    // Ignore send errors for unauthorized users
                }
            }

            // Answer callback for button clicks
            if (update.callback_query?.id) {
                try {
                    await answerCallback(env, update.callback_query.id, 'Unauthorized');
                } catch {
                    // Ignore answer errors for unauthorized users
                }
            }

            // Always return 200 to Telegram
            return addSecurityHeaders(new Response('OK', { status: 200 }));
        }

        // Process authorized requests
        logInfo('Processing update:', update.update_id, 'for user:', userId);

        if (update.callback_query) {
            await handleCallback(env, update.callback_query);
        } else if (update.message?.text) {
            await handleMessage(env, update.message);
        }

        return addSecurityHeaders(new Response('OK', { status: 200 }));
    } catch (error) {
        logError('Webhook error:', sanitizeError(error));
        // Always return 200 to Telegram to prevent retries
        return addSecurityHeaders(new Response('OK', { status: 200 }));
    }
}

/**
 * Handle incoming GitHub webhook with signature verification
 */
async function handleGitHubWebhookEndpoint(request: Request, env: Env): Promise<Response> {
    try {
        const result = await handleGitHubWebhook(env, request);

        if (!result.processed) {
            logInfo('GitHub webhook not processed:', result.message);
        }

        return secureJsonResponse(result);
    } catch (error) {
        logError('GitHub webhook error:', sanitizeError(error));
        return secureErrorResponse(error);
    }
}

/**
 * Protected setup endpoint - requires ADMIN_SECRET
 */
async function handleProtectedSetup(request: Request, url: URL, env: Env): Promise<Response> {
    // SECURITY: Verify admin secret
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
                    allowed_updates: ['message', 'callback_query'],
                }),
            }
        );

        const result = await response.json();
        return secureJsonResponse({ webhookUrl, result });
    } catch (error) {
        return secureErrorResponse(error);
    }
}

/**
 * Protected migrate endpoint - requires ADMIN_SECRET
 */
async function handleProtectedMigrate(request: Request, env: Env): Promise<Response> {
    // SECURITY: Verify admin secret
    if (!await verifyAdminSecret(request, env)) {
        return secureJsonResponse({ error: 'Unauthorized' }, 401);
    }

    try {
        // Original schema creation
        await env.DB.exec(`
            -- Drafts table with chat_id for ownership
            CREATE TABLE IF NOT EXISTS drafts (
                id TEXT PRIMARY KEY,
                chat_id TEXT NOT NULL,
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

            -- Published posts archive with chat_id for ownership
            CREATE TABLE IF NOT EXISTS published (
                id TEXT PRIMARY KEY,
                chat_id TEXT NOT NULL,
                draft_id TEXT NOT NULL,
                pr_number INTEGER NOT NULL,
                tweet_ids TEXT NOT NULL,
                tweet_url TEXT,
                image_url TEXT,
                published_at TEXT DEFAULT (datetime('now'))
            );

            -- Watched repos with chat_id for ownership
            CREATE TABLE IF NOT EXISTS repos (
                id TEXT PRIMARY KEY,
                chat_id TEXT NOT NULL,
                owner TEXT NOT NULL,
                repo TEXT NOT NULL,
                is_watching INTEGER DEFAULT 1,
                config TEXT NOT NULL,
                webhook_id TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                UNIQUE(chat_id, owner, repo)
            );

            -- Indexes for performance
            CREATE INDEX IF NOT EXISTS idx_drafts_status ON drafts(status);
            CREATE INDEX IF NOT EXISTS idx_drafts_chat_id ON drafts(chat_id);
            CREATE INDEX IF NOT EXISTS idx_drafts_pr ON drafts(pr_number);
            CREATE INDEX IF NOT EXISTS idx_published_pr ON published(pr_number);
            CREATE INDEX IF NOT EXISTS idx_published_chat_id ON published(chat_id);
            CREATE INDEX IF NOT EXISTS idx_repos_watching ON repos(is_watching);
            CREATE INDEX IF NOT EXISTS idx_repos_chat_id ON repos(chat_id);
        `);

        // Migration for existing data: add chat_id column if missing
        // This handles upgrading existing databases
        try {
            // Check if chat_id column exists in drafts
            const draftsInfo = await env.DB.prepare(
                "PRAGMA table_info(drafts)"
            ).all();

            const hasChatId = draftsInfo.results?.some(
                (col: any) => col.name === 'chat_id'
            );

            if (!hasChatId) {
                // Add chat_id column to existing tables
                // SECURITY: Use separate statements with parameterized queries
                // to avoid SQL injection (even though env vars are trusted)
                await env.DB.exec(`
                    ALTER TABLE drafts ADD COLUMN chat_id TEXT;
                    ALTER TABLE published ADD COLUMN chat_id TEXT;
                    ALTER TABLE repos ADD COLUMN chat_id TEXT;
                `);

                // Update existing records with parameterized queries
                const chatId = env.TELEGRAM_CHAT_ID;
                await env.DB.prepare('UPDATE drafts SET chat_id = ? WHERE chat_id IS NULL')
                    .bind(chatId)
                    .run();
                await env.DB.prepare('UPDATE published SET chat_id = ? WHERE chat_id IS NULL')
                    .bind(chatId)
                    .run();
                await env.DB.prepare('UPDATE repos SET chat_id = ? WHERE chat_id IS NULL')
                    .bind(chatId)
                    .run();

                return secureJsonResponse({
                    success: true,
                    message: 'Database migrated with chat_id columns added',
                });
            }
        } catch (migrationError) {
            // Column might already exist or migration partially complete
            logInfo('Migration note:', String(migrationError));
        }

        return secureJsonResponse({ success: true, message: 'Database migrated' });
    } catch (error) {
        logError('Migration error:', sanitizeError(error));
        return secureErrorResponse(error);
    }
}

/**
 * Handle image requests with validation and optional signed URL verification
 */
async function handleImageRequest(url: URL, env: Env): Promise<Response> {
    const key = url.pathname.replace('/image/', '');

    // SECURITY: Validate R2 key to prevent path traversal
    if (!validateR2Key(key)) {
        return addSecurityHeaders(new Response('Invalid request', { status: 400 }));
    }

    // Check for signed URL parameters
    const expires = url.searchParams.get('expires');
    const sig = url.searchParams.get('sig');

    // If signed URL parameters present, verify them
    if (expires && sig) {
        const isValid = await verifySignedImageUrl(key, expires, sig, env);
        if (!isValid) {
            return addSecurityHeaders(new Response('Unauthorized', { status: 401 }));
        }
    } else {
        // No signature - for now allow (Telegram needs direct access for sendPhoto)
        // In production, you might want to restrict this further
    }

    try {
        const object = await env.IMAGES.get(key);

        if (!object) {
            return addSecurityHeaders(new Response('Not found', { status: 404 }));
        }

        const headers = new Headers();
        headers.set('Content-Type', object.httpMetadata?.contentType || 'image/png');
        // Shorter cache for draft images, private to prevent CDN caching
        headers.set('Cache-Control', 'private, max-age=3600');
        headers.set('X-Content-Type-Options', 'nosniff');
        headers.set('X-Frame-Options', 'DENY');

        return new Response(object.body, { headers });
    } catch (error) {
        logError('Image retrieval error:', sanitizeError(error));
        return addSecurityHeaders(new Response('Error retrieving image', { status: 500 }));
    }
}
