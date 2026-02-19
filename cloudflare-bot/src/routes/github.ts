import type { Env } from '../types';
import { handleGitHubWebhook } from '../handlers/github-webhook';
import { secureJsonResponse, secureErrorResponse, sanitizeError, logInfo, logError } from '../services/security';

export async function handleGitHubWebhookEndpoint(request: Request, env: Env): Promise<Response> {
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
