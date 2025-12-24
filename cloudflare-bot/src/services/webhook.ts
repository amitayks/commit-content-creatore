/**
 * Webhook Service - Create/delete GitHub webhooks and verify signatures
 */

import type { Env } from '../types';

const GITHUB_API = 'https://api.github.com';

/**
 * Create a webhook for a repository
 */
export async function createWebhook(
    env: Env,
    owner: string,
    repo: string,
    workerUrl: string
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
                    secret: env.GITHUB_WEBHOOK_SECRET,
                    insecure_ssl: '0',
                },
            }),
        });

        if (response.ok) {
            const data = await response.json() as { id: number };
            console.log(`Created webhook ${data.id} for ${owner}/${repo}`);
            return String(data.id);
        }

        const error = await response.text();
        console.error(`Failed to create webhook for ${owner}/${repo}: ${response.status} - ${error}`);
        return null;
    } catch (error) {
        console.error(`Error creating webhook for ${owner}/${repo}:`, error);
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
            console.log(`Deleted webhook ${webhookId} from ${owner}/${repo}`);
            return true;
        }

        console.error(`Failed to delete webhook ${webhookId}: ${response.status}`);
        return false;
    } catch (error) {
        console.error(`Error deleting webhook ${webhookId}:`, error);
        return false;
    }
}

/**
 * Verify GitHub webhook signature
 */
export async function verifyWebhookSignature(
    secret: string,
    payload: string,
    signature: string
): Promise<boolean> {
    if (!signature) {
        return false;
    }

    // Expected format: sha256=...
    const parts = signature.split('=');
    if (parts.length !== 2 || parts[0] !== 'sha256') {
        return false;
    }

    const expectedSignature = parts[1];

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

    return computedSignature === expectedSignature;
}
