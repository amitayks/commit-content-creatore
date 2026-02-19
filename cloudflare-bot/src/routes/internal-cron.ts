/**
 * Internal Cron Route — POST /internal/user-cron
 *
 * Called by the cron coordinator via self-fetch fan-out.
 * Runs all per-user cron tasks with a hydrated env.
 */

import type { Env } from '../types';
import { verifyAdminSecret, secureJsonResponse, logInfo, logError, sanitizeError } from '../services/security';
import { hydrateEnv } from '../services/user-keys';
import { pollUserAccounts } from '../services/poller';
import { publishUserDrafts, checkUserStaleVideos, publishUserScheduledVideos } from '../handlers/cron';

export async function handleInternalCron(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
        return secureJsonResponse({ error: 'Method not allowed' }, 405);
    }

    if (!await verifyAdminSecret(request, env)) {
        return secureJsonResponse({ error: 'Unauthorized' }, 401);
    }

    let body: { chatId?: string };
    try {
        body = await request.json() as { chatId?: string };
    } catch {
        return secureJsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const chatId = body.chatId;
    if (!chatId) {
        return secureJsonResponse({ error: 'Missing chatId' }, 400);
    }

    logInfo(`[internal-cron] Starting per-user cron for chat ${chatId}`);

    // Hydrate env with user's API keys
    let userEnv: Env;
    try {
        userEnv = await hydrateEnv(env, chatId);
    } catch (error) {
        logError(`[internal-cron] Key hydration failed for chat ${chatId}:`, sanitizeError(error));
        return secureJsonResponse({ error: 'Key hydration failed', chatId }, 500);
    }

    const results: Record<string, string> = {};

    // Run all per-user cron tasks
    try {
        await pollUserAccounts(userEnv, chatId);
        results.poller = 'ok';
    } catch (error) {
        logError(`[internal-cron] Poller failed for chat ${chatId}:`, sanitizeError(error));
        results.poller = 'error';
    }

    try {
        await publishUserDrafts(userEnv, chatId);
        results.drafts = 'ok';
    } catch (error) {
        logError(`[internal-cron] Draft publishing failed for chat ${chatId}:`, sanitizeError(error));
        results.drafts = 'error';
    }

    try {
        await checkUserStaleVideos(userEnv, chatId);
        results.staleVideos = 'ok';
    } catch (error) {
        logError(`[internal-cron] Stale video check failed for chat ${chatId}:`, sanitizeError(error));
        results.staleVideos = 'error';
    }

    try {
        await publishUserScheduledVideos(userEnv, chatId);
        results.scheduledVideos = 'ok';
    } catch (error) {
        logError(`[internal-cron] Scheduled video publishing failed for chat ${chatId}:`, sanitizeError(error));
        results.scheduledVideos = 'error';
    }

    logInfo(`[internal-cron] Completed for chat ${chatId}:`, JSON.stringify(results));
    return secureJsonResponse({ ok: true, chatId, results });
}
