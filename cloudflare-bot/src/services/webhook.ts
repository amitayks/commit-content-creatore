/**
 * Webhook Service - Create/delete GitHub webhooks and verify signatures
 *
 * SECURITY: Uses timing-safe comparison for signature verification
 */

import type { Env } from '../types';
import { timingSafeEqual, sanitizeError } from './security';

const GITHUB_API = 'https://api.github.com';

/**
 * Create a webhook for a repository
 */
export async function createWebhook(
    env: Env,
    owner: string,
    repo: string,
    workerUrl: string,
    secret: string
): Promise<string | null> {
    try {
        const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/hooks`, {
            method: 'POST',
            headers: {
                Authorization: `token ${env.GITHUB_TOKEN}`,
                Accept: 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
                'User-Agent': 'content-bot',
            },
            body: JSON.stringify({
                name: 'web',
                active: true,
                events: ['push', 'pull_request'],
                config: {
                    url: `${workerUrl}/github-webhook`,
                    content_type: 'json',
                    secret,
                    insecure_ssl: '0',
                },
            }),
        });

        if (response.ok) {
            const data = await response.json() as { id: number };
            // SECURITY: Only log non-sensitive info
            console.log(`Created webhook for ${owner}/${repo}`);
            return String(data.id);
        }

        // SECURITY: Don't log full error response (may contain tokens in URL)
        console.error(`Failed to create webhook for ${owner}/${repo}: ${response.status}`);
        return null;
    } catch (error) {
        // SECURITY: Use sanitized error
        console.error(`Error creating webhook for ${owner}/${repo}:`, sanitizeError(error));
        return null;
    }
}

/**
 * Delete a webhook from a repository
 */
export async function deleteWebhook(
    env: Env,
    owner: string,
    repo: string,
    webhookId: string
): Promise<boolean> {
    try {
        const response = await fetch(
            `${GITHUB_API}/repos/${owner}/${repo}/hooks/${webhookId}`,
            {
                method: 'DELETE',
                headers: {
                    Authorization: `token ${env.GITHUB_TOKEN}`,
                    Accept: 'application/vnd.github.v3+json',
                    'User-Agent': 'content-bot',
                },
            }
        );

        if (response.ok || response.status === 404) {
            // 404 means already deleted, which is fine
            // SECURITY: Only log non-sensitive info
            console.log(`Deleted webhook from ${owner}/${repo}`);
            return true;
        }

        console.error(`Failed to delete webhook: ${response.status}`);
        return false;
    } catch (error) {
        // SECURITY: Use sanitized error
        console.error(`Error deleting webhook:`, sanitizeError(error));
        return false;
    }
}

/**
 * Verify GitHub webhook signature using timing-safe comparison
 * SECURITY: Uses HMAC-SHA256 with timing-safe comparison to prevent timing attacks
 */
export async function verifyWebhookSignature(
    secret: string,
    payload: string,
    signature: string
): Promise<boolean> {
    // SECURITY: Reject missing signatures
    if (!signature) {
        return false;
    }

    // Expected format: sha256=...
    const parts = signature.split('=');
    if (parts.length !== 2 || parts[0] !== 'sha256') {
        return false;
    }

    const expectedSignature = parts[1];

    // SECURITY: Validate signature format (hex string)
    if (!/^[a-f0-9]{64}$/i.test(expectedSignature)) {
        return false;
    }

    // Generate HMAC-SHA256
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(payload)
    );

    // Convert to hex
    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    // SECURITY: Use timing-safe comparison to prevent timing attacks
    return await timingSafeEqual(computedSignature, expectedSignature.toLowerCase());
}
