import type { Env } from '../types';
import { verifyAdminSecret, addSecurityHeaders, secureJsonResponse } from '../services/security';

export async function handleTestX(request: Request, env: Env): Promise<Response> {
    if (!verifyAdminSecret(request, env)) {
        return addSecurityHeaders(new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        }));
    }
    const { verifyCredentials } = await import('../services/x');
    const isValid = await verifyCredentials(env);
    return secureJsonResponse({
        success: isValid,
        message: isValid ? 'X API credentials are valid' : 'X API credentials are invalid'
    });
}
