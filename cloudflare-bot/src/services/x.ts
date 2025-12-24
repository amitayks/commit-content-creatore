/**
 * X (Twitter) Service - Tweet posting and media upload
 */

import type { Env, DraftContent } from '../types';

const X_API_V2 = 'https://api.twitter.com/2';
const X_UPLOAD_API = 'https://upload.twitter.com/1.1';

/**
 * Generate HMAC-SHA1 signature using Web Crypto API
 */
async function hmacSha1(key: string, message: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(key);
    const messageData = encoder.encode(message);

    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-1' },
        false,
        ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

/**
 * Percent encode for OAuth (RFC 3986)
 */
function percentEncode(str: string): string {
    return encodeURIComponent(str)
        .replace(/!/g, '%21')
        .replace(/\*/g, '%2A')
        .replace(/'/g, '%27')
        .replace(/\(/g, '%28')
        .replace(/\)/g, '%29');
}

/**
 * Generate OAuth 1.0a signature for X API requests
 */
async function generateOAuthHeader(
    env: Env,
    method: string,
    url: string,
    bodyParams: Record<string, string> = {}
): Promise<string> {
    const oauthParams: Record<string, string> = {
        oauth_consumer_key: env.X_API_KEY,
        oauth_token: env.X_ACCESS_TOKEN,
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
        oauth_nonce: crypto.randomUUID().replace(/-/g, ''),
        oauth_version: '1.0',
    };

    // Combine OAuth params with body params for signature
    const allParams = { ...oauthParams, ...bodyParams };
    const sortedKeys = Object.keys(allParams).sort();
    const paramString = sortedKeys
        .map((k) => `${percentEncode(k)}=${percentEncode(allParams[k])}`)
        .join('&');

    // Create signature base string
    const signatureBase = `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(paramString)}`;

    // Create signing key
    const signingKey = `${percentEncode(env.X_API_SECRET)}&${percentEncode(env.X_ACCESS_SECRET)}`;

    // Generate HMAC-SHA1 signature
    const signature = await hmacSha1(signingKey, signatureBase);
    oauthParams.oauth_signature = signature;

    // Build Authorization header
    const headerParts = Object.entries(oauthParams)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${percentEncode(k)}="${percentEncode(v)}"`)
        .join(', ');

    return `OAuth ${headerParts}`;
}

/**
 * Post a single tweet
 */
export async function postTweet(
    env: Env,
    text: string,
    options: { replyToId?: string; mediaIds?: string[] } = {}
): Promise<string> {
    const body: Record<string, unknown> = { text };

    if (options.replyToId) {
        body.reply = { in_reply_to_tweet_id: options.replyToId };
    }

    if (options.mediaIds && options.mediaIds.length > 0) {
        body.media = { media_ids: options.mediaIds };
    }

    const url = `${X_API_V2}/tweets`;
    const authHeader = await generateOAuthHeader(env, 'POST', url);

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`X API error ${response.status}: ${error}`);
    }

    const data = await response.json() as { data: { id: string } };
    console.log('Posted tweet:', data.data.id);
    return data.data.id;
}

/**
 * Post a thread (multiple tweets)
 */
export async function postThread(
    env: Env,
    content: DraftContent,
    mediaId?: string
): Promise<{ tweetIds: string[]; url: string }> {
    const tweetIds: string[] = [];
    let previousId: string | undefined;

    for (let i = 0; i < content.tweets.length; i++) {
        const tweet = content.tweets[i];

        // Add delay between tweets
        if (i > 0) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        // Only attach media to first tweet
        const mediaIds = i === 0 && mediaId ? [mediaId] : undefined;

        const tweetId = await postTweet(env, tweet.text, {
            replyToId: previousId,
            mediaIds,
        });

        tweetIds.push(tweetId);
        previousId = tweetId;

        console.log(`Posted tweet ${i + 1}/${content.tweets.length}:`, tweetId);
    }

    const url = `https://x.com/i/status/${tweetIds[0]}`;
    return { tweetIds, url };
}

/**
 * Upload media to X
 */
export async function uploadMedia(env: Env, imageUrl: string): Promise<string> {
    // Download the image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
        throw new Error('Failed to download image');
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Data = btoa(
        String.fromCharCode(...new Uint8Array(imageBuffer))
    );

    const url = `${X_UPLOAD_API}/media/upload.json`;
    const authHeader = await generateOAuthHeader(env, 'POST', url, { media_data: base64Data });

    const body = new URLSearchParams({
        media_data: base64Data,
    });

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`X Media Upload error: ${error}`);
    }

    const data = await response.json() as { media_id_string: string };
    console.log('Uploaded media:', data.media_id_string);
    return data.media_id_string;
}

/**
 * Delete a tweet
 */
export async function deleteTweet(env: Env, tweetId: string): Promise<void> {
    const url = `${X_API_V2}/tweets/${tweetId}`;
    const authHeader = await generateOAuthHeader(env, 'DELETE', url);

    const response = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: authHeader },
    });

    // 404 means already deleted - that's ok
    if (!response.ok && response.status !== 404) {
        const error = await response.text();
        throw new Error(`X delete error: ${error}`);
    }

    console.log('Deleted tweet:', tweetId);
}

/**
 * Get tweet URL
 */
export function getTweetUrl(tweetId: string): string {
    return `https://x.com/i/status/${tweetId}`;
}
