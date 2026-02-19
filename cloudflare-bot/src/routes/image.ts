import type { Env } from '../types';
import { validateR2Key, verifySignedImageUrl, addSecurityHeaders, sanitizeError, logError } from '../services/security';

export async function handleImageRequest(url: URL, env: Env): Promise<Response> {
    const key = url.pathname.replace('/image/', '');

    if (!validateR2Key(key)) {
        return addSecurityHeaders(new Response('Invalid request', { status: 400 }));
    }

    const expires = url.searchParams.get('expires');
    const sig = url.searchParams.get('sig');

    if (expires && sig) {
        const isValid = await verifySignedImageUrl(key, expires, sig, env);
        if (!isValid) {
            return addSecurityHeaders(new Response('Unauthorized', { status: 401 }));
        }
    }

    try {
        const object = await env.IMAGES.get(key);

        if (!object) {
            return addSecurityHeaders(new Response('Not found', { status: 404 }));
        }

        const headers = new Headers();
        headers.set('Content-Type', object.httpMetadata?.contentType || 'image/png');
        headers.set('Cache-Control', 'private, max-age=3600');
        headers.set('X-Content-Type-Options', 'nosniff');
        headers.set('X-Frame-Options', 'DENY');

        return new Response(object.body, { headers });
    } catch (error) {
        logError('Image retrieval error:', sanitizeError(error));
        return addSecurityHeaders(new Response('Error retrieving image', { status: 500 }));
    }
}
