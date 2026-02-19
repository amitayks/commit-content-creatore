/**
 * Media route — serves video and image files from R2
 *
 * Publicly accessible (needed for Instagram fetching).
 * Path traversal prevention for security.
 */

import type { Env } from '../types';
import { addSecurityHeaders, logError, sanitizeError } from '../services/security';

export async function handleMediaRequest(url: URL, env: Env): Promise<Response> {
    const key = decodeURIComponent(url.pathname.replace('/media/', ''));

    // Path traversal prevention
    if (key.includes('..') || key.includes('//') || !key || key.startsWith('/')) {
        return addSecurityHeaders(new Response('Invalid request', { status: 400 }));
    }

    try {
        const object = await env.IMAGES.get(key);

        if (!object) {
            return addSecurityHeaders(new Response('Not found', { status: 404 }));
        }

        const contentType = object.httpMetadata?.contentType || 'application/octet-stream';
        const headers = new Headers();
        headers.set('Content-Type', contentType);
        headers.set('Content-Length', String(object.size));
        headers.set('Accept-Ranges', 'bytes');
        headers.set('Cache-Control', 'public, max-age=86400'); // 24h cache for public access
        headers.set('X-Content-Type-Options', 'nosniff');

        return new Response(object.body, { headers });
    } catch (error) {
        logError('Media retrieval error:', sanitizeError(error));
        return addSecurityHeaders(new Response('Error retrieving media', { status: 500 }));
    }
}
