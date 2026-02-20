/**
 * Cloudflare Bot - Main Entry Point
 *
 * Thin routing shell: URL matching, rate limiting, delegation to route handlers.
 */

import type { Env } from './types';
import { cronCoordinator } from './handlers/cron';
import {
    addSecurityHeaders,
    secureErrorResponse,
    sanitizeError,
    checkRateLimit,
    rateLimitResponse,
    addRateLimitHeaders,
    RATE_LIMITS,
    logInfo,
    logError,
} from './services/security';

import { handleTelegramWebhook } from './routes/webhook';
import { handleGitHubWebhookEndpoint } from './routes/github';
import { handleSetup } from './routes/setup';
import { handleMigrate } from './routes/migrate';
import { handleTestX } from './routes/test-x';
import { handleTestGenerate } from './routes/test-generate';
import { handleImageRequest } from './routes/image';
import { handleHeyGenWebhook } from './routes/heygen-webhook';
import { handleMediaRequest } from './routes/media';


export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);
        const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';

        try {
            if (url.pathname === '/health') {
                return addSecurityHeaders(new Response('OK', { status: 200 }));
            }

            if (url.pathname === '/webhook' && request.method === 'POST') {
                const rateLimit = checkRateLimit(`webhook:${clientIP}`, RATE_LIMITS.webhook);
                if (!rateLimit.allowed) return rateLimitResponse(rateLimit.resetAt, RATE_LIMITS.webhook.maxRequests);
                const response = await handleTelegramWebhook(request, env, ctx);
                return addRateLimitHeaders(response, rateLimit.remaining, rateLimit.resetAt, RATE_LIMITS.webhook.maxRequests);
            }

            if (url.pathname === '/github-webhook' && request.method === 'POST') {
                const rateLimit = checkRateLimit(`github:${clientIP}`, RATE_LIMITS.github);
                if (!rateLimit.allowed) return rateLimitResponse(rateLimit.resetAt, RATE_LIMITS.github.maxRequests);
                const response = await handleGitHubWebhookEndpoint(request, env);
                return addRateLimitHeaders(response, rateLimit.remaining, rateLimit.resetAt, RATE_LIMITS.github.maxRequests);
            }

            if (url.pathname === '/setup') {
                const rateLimit = checkRateLimit(`admin:${clientIP}`, RATE_LIMITS.admin);
                if (!rateLimit.allowed) return rateLimitResponse(rateLimit.resetAt, RATE_LIMITS.admin.maxRequests);
                const response = await handleSetup(request, url, env);
                return addRateLimitHeaders(response, rateLimit.remaining, rateLimit.resetAt, RATE_LIMITS.admin.maxRequests);
            }

            if (url.pathname === '/migrate') {
                const rateLimit = checkRateLimit(`admin:${clientIP}`, RATE_LIMITS.admin);
                if (!rateLimit.allowed) return rateLimitResponse(rateLimit.resetAt, RATE_LIMITS.admin.maxRequests);
                const response = await handleMigrate(request, env);
                return addRateLimitHeaders(response, rateLimit.remaining, rateLimit.resetAt, RATE_LIMITS.admin.maxRequests);
            }

            if (url.pathname === '/test-x') {
                const rateLimit = checkRateLimit(`admin:${clientIP}`, RATE_LIMITS.admin);
                if (!rateLimit.allowed) return rateLimitResponse(rateLimit.resetAt, RATE_LIMITS.admin.maxRequests);
                const response = await handleTestX(request, env);
                return addRateLimitHeaders(response, rateLimit.remaining, rateLimit.resetAt, RATE_LIMITS.admin.maxRequests);
            }

            if (url.pathname === '/heygen-webhook' && request.method === 'POST') {
                const rateLimit = checkRateLimit(`heygen:${clientIP}`, RATE_LIMITS.github);
                if (!rateLimit.allowed) return rateLimitResponse(rateLimit.resetAt, RATE_LIMITS.github.maxRequests);
                const response = await handleHeyGenWebhook(request, env);
                return addRateLimitHeaders(response, rateLimit.remaining, rateLimit.resetAt, RATE_LIMITS.github.maxRequests);
            }

            if (url.pathname.startsWith('/media/')) {
                const rateLimit = checkRateLimit(`media:${clientIP}`, RATE_LIMITS.image);
                if (!rateLimit.allowed) return rateLimitResponse(rateLimit.resetAt, RATE_LIMITS.image.maxRequests);
                const response = await handleMediaRequest(url, env);
                return addRateLimitHeaders(response, rateLimit.remaining, rateLimit.resetAt, RATE_LIMITS.image.maxRequests);
            }

            if (url.pathname.startsWith('/image/')) {
                const rateLimit = checkRateLimit(`image:${clientIP}`, RATE_LIMITS.image);
                if (!rateLimit.allowed) return rateLimitResponse(rateLimit.resetAt, RATE_LIMITS.image.maxRequests);
                const response = await handleImageRequest(url, env);
                return addRateLimitHeaders(response, rateLimit.remaining, rateLimit.resetAt, RATE_LIMITS.image.maxRequests);
            }

            if (url.pathname === '/test-generate' && request.method === 'GET') {
                const response = await handleTestGenerate(request, url, env);
                return response;
            }

            return addSecurityHeaders(new Response('Not Found', { status: 404 }));
        } catch (error) {
            logError('Unhandled error:', error);
            return secureErrorResponse(error);
        }
    },

    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        logInfo('Cron triggered at:', new Date(event.scheduledTime).toISOString());
        try {
            await cronCoordinator(env, ctx);
        } catch (error) {
            logError('Cron error:', sanitizeError(error));
        }
    },
};
