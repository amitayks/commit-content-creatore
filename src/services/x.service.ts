/**
 * X (Twitter) service for publishing tweets and threads.
 */

import crypto from 'crypto';
import { API_KEYS, RATE_LIMITS } from '../constants.js';
import type { Draft, Tweet } from '../types/index.js';
import logger from '../utils/logger.js';
import { isRateLimitError, retryWithBackoff, sleep } from '../utils/retry.js';

/** X API response for tweet creation */
interface TweetResponse {
  data: {
    id: string;
    text: string;
  };
}

/** OAuth 1.0a signature components */
interface OAuthParams {
  oauth_consumer_key: string;
  oauth_token: string;
  oauth_signature_method: string;
  oauth_timestamp: string;
  oauth_nonce: string;
  oauth_version: string;
  oauth_signature?: string;
  [key: string]: string | undefined;
}

/**
 * X (Twitter) service for publishing content.
 */
export class XService {
  private apiKey: string;
  private apiSecret: string;
  private accessToken: string;
  private accessSecret: string;
  private baseUrl = 'https://api.twitter.com/2';

  constructor() {
    this.apiKey = API_KEYS.X_API_KEY;
    this.apiSecret = API_KEYS.X_API_SECRET;
    this.accessToken = API_KEYS.X_ACCESS_TOKEN;
    this.accessSecret = API_KEYS.X_ACCESS_SECRET;
  }

  /**
   * Generate OAuth 1.0a signature.
   */
  private generateOAuthSignature(
    method: string,
    url: string,
    params: Record<string, string>
  ): string {
    // Sort parameters
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');

    // Create signature base string
    const signatureBase = [
      method.toUpperCase(),
      encodeURIComponent(url),
      encodeURIComponent(sortedParams),
    ].join('&');

    // Create signing key
    const signingKey = `${encodeURIComponent(this.apiSecret)}&${encodeURIComponent(this.accessSecret)}`;

    // Generate HMAC-SHA1 signature
    const signature = crypto.createHmac('sha1', signingKey).update(signatureBase).digest('base64');

    return signature;
  }

  /**
   * Generate OAuth header.
   */
  private generateOAuthHeader(method: string, url: string): string {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString('hex');

    const baseParams: Record<string, string> = {
      oauth_consumer_key: this.apiKey,
      oauth_token: this.accessToken,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_nonce: nonce,
      oauth_version: '1.0',
    };

    // Generate signature
    const signature = this.generateOAuthSignature(method, url, baseParams);

    // Build header string with signature
    const allParams = { ...baseParams, oauth_signature: signature };
    const headerParts = Object.entries(allParams)
      .map(([key, value]) => `${encodeURIComponent(key)}="${encodeURIComponent(value)}"`)
      .join(', ');

    return `OAuth ${headerParts}`;
  }

  /**
   * Make an authenticated request to X API.
   */
  private async request<T>(
    method: string,
    endpoint: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const authHeader = this.generateOAuthHeader(method, url);

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      if (response.status === 429) {
        const resetTime = response.headers.get('x-rate-limit-reset');
        throw new Error(`Rate limit exceeded. Reset at: ${resetTime}. ${error}`);
      }
      throw new Error(`X API error ${response.status}: ${error}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Post a single tweet.
   */
  async postTweet(
    text: string,
    options: { replyToId?: string; mediaIds?: string[] } = {}
  ): Promise<string> {
    return retryWithBackoff(
      async () => {
        const body: Record<string, unknown> = { text };

        if (options.replyToId) {
          body.reply = { in_reply_to_tweet_id: options.replyToId };
        }

        if (options.mediaIds && options.mediaIds.length > 0) {
          body.media = { media_ids: options.mediaIds };
        }

        const result = await this.request<TweetResponse>('POST', '/tweets', body);

        logger.info(`Posted tweet`, { id: result.data.id });
        return result.data.id;
      },
      {
        shouldRetry: (error) => {
          // Retry on rate limits and transient errors
          if (isRateLimitError(error)) {
            logger.warn('Rate limited, will retry');
            return true;
          }
          return false;
        },
        context: 'postTweet',
        maxRetries: 2,
        initialDelay: 5000,
      }
    );
  }

  /**
   * Post a thread (multiple tweets).
   */
  async postThread(tweets: Tweet[]): Promise<string[]> {
    const tweetIds: string[] = [];
    let previousId: string | undefined;

    for (let i = 0; i < tweets.length; i++) {
      const tweet = tweets[i];

      // Add delay between tweets to avoid rate limiting
      if (i > 0) {
        await sleep(1000);
      }

      try {
        const tweetId = await this.postTweet(tweet.text, {
          replyToId: previousId,
          // mediaIds: tweet.mediaPath ? [await this.uploadMedia(tweet.mediaPath)] : undefined,
        });

        tweetIds.push(tweetId);
        previousId = tweetId;

        logger.info(`Posted tweet ${i + 1}/${tweets.length}`, { tweetId });
      } catch (error) {
        logger.error(`Failed to post tweet ${i + 1}/${tweets.length}`, { error });
        throw error;
      }
    }

    return tweetIds;
  }

  /**
   * Publish a draft to X.
   */
  async publishDraft(draft: Draft): Promise<{ tweetIds: string[]; url: string }> {
    logger.info(`Publishing draft to X`, { draftId: draft.id, format: draft.content.format });

    const tweetIds = await this.postThread(draft.content.tweets);
    const url = `https://x.com/i/web/status/${tweetIds[0]}`;

    return { tweetIds, url };
  }

  /**
   * Delete a tweet.
   */
  async deleteTweet(tweetId: string): Promise<void> {
    await this.request('DELETE', `/tweets/${tweetId}`);
    logger.info(`Deleted tweet`, { tweetId });
  }

  /**
   * Get current rate limit status.
   */
  async getRateLimitStatus(): Promise<{
    remaining: number;
    limit: number;
    resetAt: Date;
  }> {
    // X API v2 returns rate limit info in response headers
    // For now, return estimated values based on free tier
    return {
      remaining: RATE_LIMITS.X_DAILY_LIMIT,
      limit: RATE_LIMITS.X_DAILY_LIMIT,
      resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  /**
   * Verify credentials.
   */
  async verifyCredentials(): Promise<boolean> {
    try {
      await this.request('GET', '/users/me');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get tweet URL.
   */
  getTweetUrl(tweetId: string): string {
    return `https://x.com/i/web/status/${tweetId}`;
  }
}

// Export singleton instance
export const xService = new XService();
