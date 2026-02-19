/**
 * X (Twitter) Service - Read & write operations, OAuth 1.0a
 */

import type { Env, DraftContent } from '../types';

const X_API_V2 = 'https://api.twitter.com/2';
const X_UPLOAD_API = 'https://upload.twitter.com/1.1';

// ==================== X API Types (used by poller) ====================

export interface XUser {
    id: string;
    name: string;
    username: string;
    description?: string;
    profile_image_url?: string;
    public_metrics?: {
        followers_count: number;
        following_count: number;
        tweet_count: number;
    };
}

export interface XTweet {
    id: string;
    text: string;
    author_id?: string;
    conversation_id?: string;
    in_reply_to_user_id?: string;
    created_at?: string;
    referenced_tweets?: Array<{
        type: 'retweeted' | 'quoted' | 'replied_to';
        id: string;
    }>;
    attachments?: { media_keys?: string[] };
    public_metrics?: {
        retweet_count: number;
        reply_count: number;
        like_count: number;
        quote_count: number;
        impression_count: number;
    };
}

export interface XMedia {
    media_key: string;
    type: 'photo' | 'video' | 'animated_gif';
    url?: string;
    preview_image_url?: string;
}

/**
 * Get the first relevant media URL for a tweet.
 * For photos: returns the photo URL. For videos/gifs: returns the thumbnail.
 */
export function getMediaUrl(media: XMedia[] | undefined, tweet: XTweet): string | null {
    if (!media || !tweet.attachments?.media_keys?.length) return null;

    const tweetMediaKeys = tweet.attachments.media_keys;
    const tweetMedia = media.filter(m => tweetMediaKeys.includes(m.media_key));

    const photo = tweetMedia.find(m => m.type === 'photo');
    if (photo?.url) return photo.url;

    const videoOrGif = tweetMedia.find(m => m.type === 'video' || m.type === 'animated_gif');
    if (videoOrGif?.preview_image_url) return videoOrGif.preview_image_url;

    return null;
}

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
export async function generateOAuthHeader(
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
 * Verify X API credentials by getting account info
 */
export async function verifyCredentials(env: Env): Promise<boolean> {
    const url = 'https://api.twitter.com/1.1/account/verify_credentials.json';
    const authHeader = await generateOAuthHeader(env, 'GET', url);

    const response = await fetch(url, {
        method: 'GET',
        headers: { Authorization: authHeader },
    });

    if (!response.ok) {
        const error = await response.text();
        console.error('X credential verification failed:', response.status, error);
        return false;
    }

    const data = await response.json() as { screen_name: string };
    console.log('X credentials valid for:', data.screen_name);
    return true;
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
        console.error('X postTweet failed:', response.status, error);
        throw new Error(`X API error ${response.status}: ${error}`);
    }

    const data = await response.json() as { data: { id: string } };
    console.log('Posted tweet:', data.data.id);
    return data.data.id;
}

/**
 * Post a thread (multiple tweets)
 * @param mediaId - Single media ID for first tweet (legacy auto-generated drafts)
 * @param perTweetMediaIds - Per-tweet media IDs array (handwritten drafts). null entries = no media for that tweet.
 */
export async function postThread(
    env: Env,
    content: DraftContent,
    mediaId?: string,
    perTweetMediaIds?: (string | null)[]
): Promise<{ tweetIds: string[]; url: string }> {
    const tweetIds: string[] = [];
    let previousId: string | undefined;

    for (let i = 0; i < content.tweets.length; i++) {
        const tweet = content.tweets[i];

        // Add delay between tweets
        if (i > 0) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        // Determine media for this tweet
        let mediaIds: string[] | undefined;
        if (perTweetMediaIds && perTweetMediaIds[i]) {
            mediaIds = [perTweetMediaIds[i]!];
        } else if (i === 0 && mediaId) {
            mediaIds = [mediaId];
        }

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
 * Upload media to X from URL
 */
export async function uploadMedia(env: Env, imageUrl: string): Promise<string> {
    // Download the image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
        throw new Error('Failed to download image');
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    return uploadMediaFromBuffer(env, imageBuffer);
}

/**
 * Upload media to X from ArrayBuffer (for R2 images)
 */
export async function uploadMediaFromBuffer(env: Env, imageBuffer: ArrayBuffer): Promise<string> {

    // Convert to base64 without stack overflow (chunked approach)
    const bytes = new Uint8Array(imageBuffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64Data = btoa(binary);

    const url = `${X_UPLOAD_API}/media/upload.json`;
    // Include media_data in OAuth signature - Twitter requires this
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
        console.error('X Media Upload failed:', response.status, error);
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
 * Post a quote tweet (repost)
 */
export async function postQuoteTweet(
    env: Env,
    text: string,
    quoteTweetId: string,
    options: { mediaIds?: string[] } = {}
): Promise<string> {
    const body: Record<string, unknown> = {
        text,
        quote_tweet_id: quoteTweetId,
    };

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
        console.error('X postQuoteTweet failed:', response.status, error);
        throw new Error(`X API error ${response.status}: ${error}`);
    }

    const data = await response.json() as { data: { id: string } };
    console.log('Posted quote tweet:', data.data.id);
    return data.data.id;
}

/**
 * Lookup a user by username
 * GET /2/users/by/username/:username
 */
export async function lookupUserByUsername(
    env: Env,
    username: string
): Promise<XUser | null> {
    const cleanUsername = username.replace(/^@/, '');
    const baseUrl = `${X_API_V2}/users/by/username/${cleanUsername}`;
    const queryParams: Record<string, string> = {
        'user.fields': 'id,name,username,description,profile_image_url,public_metrics',
    };

    const queryString = Object.entries(queryParams)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
    const fullUrl = `${baseUrl}?${queryString}`;

    const authHeader = await generateOAuthHeader(env, 'GET', baseUrl, queryParams);

    const response = await fetch(fullUrl, {
        method: 'GET',
        headers: { Authorization: authHeader },
    });

    if (!response.ok) {
        console.error(`X lookupUser failed for @${cleanUsername}:`, response.status);
        return null;
    }

    const data = await response.json() as { data?: XUser; errors?: unknown[] };
    if (data.errors || !data.data) {
        console.error(`[x] User @${cleanUsername} not found`);
        return null;
    }
    return data.data;
}

/**
 * Fetch a single tweet by ID with author expansions
 * Returns tweet data + expanded author profile + media
 */
export interface TweetMedia {
    media_key: string;
    type: 'photo' | 'video' | 'animated_gif';
    url?: string;
    preview_image_url?: string;
    alt_text?: string;
}

export interface TweetWithAuthor {
    tweet: {
        id: string;
        text: string;
        author_id?: string;
        conversation_id?: string;
        in_reply_to_user_id?: string;
        created_at?: string;
        referenced_tweets?: Array<{ type: string; id: string }>;
        attachments?: { media_keys?: string[] };
        public_metrics?: {
            retweet_count: number;
            reply_count: number;
            like_count: number;
            quote_count: number;
            impression_count?: number;
        };
    };
    author: {
        id: string;
        name: string;
        username: string;
        description?: string;
        profile_image_url?: string;
        public_metrics?: {
            followers_count: number;
            following_count: number;
            tweet_count: number;
        };
    } | null;
    media?: TweetMedia[];
}

export async function getTweetById(env: Env, tweetId: string): Promise<TweetWithAuthor | null> {
    const baseUrl = `${X_API_V2}/tweets/${tweetId}`;
    const queryParams: Record<string, string> = {
        'tweet.fields': 'text,author_id,conversation_id,in_reply_to_user_id,created_at,referenced_tweets,public_metrics,attachments',
        'expansions': 'author_id,attachments.media_keys',
        'user.fields': 'id,name,username,description,profile_image_url,public_metrics',
        'media.fields': 'media_key,type,url,preview_image_url,alt_text',
    };

    const queryString = Object.entries(queryParams)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
    const fullUrl = `${baseUrl}?${queryString}`;

    const authHeader = await generateOAuthHeader(env, 'GET', baseUrl, queryParams);

    const response = await fetch(fullUrl, {
        method: 'GET',
        headers: { Authorization: authHeader },
    });

    if (!response.ok) {
        console.error(`[x] getTweetById failed for ${tweetId}:`, response.status);
        return null;
    }

    const data = await response.json() as {
        data?: TweetWithAuthor['tweet'];
        includes?: { users?: TweetWithAuthor['author'][]; media?: TweetMedia[] };
        errors?: unknown[];
    };

    if (!data.data) return null;

    const author = data.includes?.users?.[0] || null;
    const media = data.includes?.media;

    return { tweet: data.data, author, media };
}

/**
 * Get tweet URL
 */
export function getTweetUrl(tweetId: string): string {
    return `https://x.com/i/status/${tweetId}`;
}

// ==================== Read Functions (from twitter-poller) ====================

/**
 * Get a user's recent tweets
 * GET /2/users/:id/tweets
 */
export async function getUserTweets(
    env: Env,
    userId: string,
    sinceId?: string,
    maxResults = 10
): Promise<{ tweets: XTweet[]; newestId: string | null; media?: XMedia[] }> {
    const baseUrl = `${X_API_V2}/users/${userId}/tweets`;
    const queryParams: Record<string, string> = {
        'tweet.fields': 'id,text,author_id,conversation_id,in_reply_to_user_id,created_at,referenced_tweets,public_metrics,attachments',
        'expansions': 'attachments.media_keys',
        'media.fields': 'media_key,type,url,preview_image_url',
        'max_results': String(Math.min(Math.max(maxResults, 5), 100)),
        'exclude': 'retweets',
    };

    if (sinceId) {
        queryParams.since_id = sinceId;
    }

    const queryString = Object.entries(queryParams)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
    const fullUrl = `${baseUrl}?${queryString}`;

    const authHeader = await generateOAuthHeader(env, 'GET', baseUrl, queryParams);

    const response = await fetch(fullUrl, {
        method: 'GET',
        headers: { Authorization: authHeader },
    });

    if (!response.ok) {
        const error = await response.text();
        console.error(`[x] getUserTweets failed for user ${userId}:`, response.status, error);
        return { tweets: [], newestId: null };
    }

    const data = await response.json() as {
        data?: XTweet[];
        includes?: { media?: XMedia[] };
        meta?: { newest_id?: string; result_count?: number };
    };

    const tweets = data.data || [];
    const newestId = data.meta?.newest_id || (tweets.length > 0 ? tweets[0].id : null);
    const media = data.includes?.media;

    return { tweets, newestId, media };
}

/**
 * Search for tweets in a conversation (for full thread fetch)
 * GET /2/tweets/search/recent
 */
export async function searchConversation(
    env: Env,
    conversationId: string,
    username: string
): Promise<XTweet[]> {
    const baseUrl = `${X_API_V2}/tweets/search/recent`;
    const queryParams: Record<string, string> = {
        'query': `conversation_id:${conversationId} from:${username}`,
        'tweet.fields': 'id,text,author_id,conversation_id,in_reply_to_user_id,created_at,referenced_tweets,public_metrics',
        'max_results': '100',
    };

    const queryString = Object.entries(queryParams)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
    const fullUrl = `${baseUrl}?${queryString}`;

    const authHeader = await generateOAuthHeader(env, 'GET', baseUrl, queryParams);

    const response = await fetch(fullUrl, {
        method: 'GET',
        headers: { Authorization: authHeader },
    });

    if (!response.ok) {
        const error = await response.text();
        console.error(`[x] searchConversation failed for ${conversationId}:`, response.status, error);
        return [];
    }

    const data = await response.json() as { data?: XTweet[] };
    return data.data || [];
}
