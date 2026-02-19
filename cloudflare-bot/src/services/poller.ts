/**
 * Twitter Polling Pipeline (per-user)
 *
 * Main polling loop:
 * 1. Select chunk of accounts to poll (10 per cycle, consistent hash-based)
 * 2. For each account: fetch new tweets via X API
 * 3. Detect threads, buffer incomplete ones
 * 4. Complete stale buffered threads
 * 5. Score all pending tweets via AI
 * 6. Send batch notifications
 * 7. Auto-approve if configured
 */

import type { Env, TwitterAccount, TwitterAccountConfig, TwitterTweet, ThreadBufferEntry } from '../types';
import { getUserTweets, searchConversation, getMediaUrl, type XTweet } from './x';
import {
    getWatchingTwitterAccountsByUser,
    updateTwitterAccount,
    parseTwitterAccountConfig,
    createTwitterTweet,
    updateTwitterTweet,
} from './db';

const ACCOUNTS_PER_CYCLE = 10;

/**
 * Main polling entry point — called per-user by cron fan-out
 */
export async function pollUserAccounts(env: Env, chatId: string): Promise<void> {
    const allAccounts = await getWatchingTwitterAccountsByUser(env, chatId);
    if (allAccounts.length === 0) {
        console.log(`[poller] No watching accounts for chat ${chatId}, skipping`);
        return;
    }

    // Select chunk for this cycle
    const chunk = selectChunk(allAccounts);
    console.log(`[poller] Polling ${chunk.length}/${allAccounts.length} accounts for chat ${chatId}`);

    // Collect all pending tweets across accounts for batch scoring
    const allPendingTweets: Array<{ tweet: TwitterTweet; account: TwitterAccount; config: TwitterAccountConfig }> = [];

    for (const account of chunk) {
        try {
            const config = parseTwitterAccountConfig(account);

            if (!account.user_id) {
                console.log(`[poller] Skipping @${account.username} — no user_id (needs bootstrap)`);
                continue;
            }

            // Poll for new tweets
            const newPending = await pollSingleAccount(env, account, config);
            for (const tweet of newPending) {
                allPendingTweets.push({ tweet, account, config });
            }
        } catch (error) {
            console.error(`[poller] Error polling @${account.username}:`, error);
        }
    }

    if (allPendingTweets.length === 0) {
        console.log('[poller] No new pending tweets to process');
        return;
    }

    console.log(`[poller] ${allPendingTweets.length} pending tweets ready for scoring`);

    // Score tweets
    try {
        const { scoreTweetBatch } = await import('./scoring');
        await scoreTweetBatch(env, allPendingTweets.map(t => t.tweet));
    } catch (error) {
        console.error('[poller] Scoring failed:', error);
    }

    // Auto-approve flow (runs first — sets status to 'drafted' so batch notifications skip them)
    try {
        const { processAutoApprove } = await import('./auto-approve');
        await processAutoApprove(env, chunk);
    } catch (error) {
        console.error('[poller] Auto-approve failed:', error);
    }

    // Send batch notifications (marks remaining 'scored' tweets as 'notified')
    try {
        const { sendBatchNotifications } = await import('./batch-notification');
        await sendBatchNotifications(env, chunk);
    } catch (error) {
        console.error('[poller] Batch notifications failed:', error);
    }
}

/**
 * Select a chunk of accounts to poll this cycle.
 * Uses consistent hash-based rotation so all accounts get polled evenly.
 */
function selectChunk(accounts: TwitterAccount[]): TwitterAccount[] {
    if (accounts.length <= ACCOUNTS_PER_CYCLE) {
        return accounts;
    }

    // Rotate based on current 15-minute window
    const cycleIndex = Math.floor(Date.now() / (15 * 60 * 1000));
    const totalChunks = Math.ceil(accounts.length / ACCOUNTS_PER_CYCLE);
    const chunkIndex = cycleIndex % totalChunks;
    const start = chunkIndex * ACCOUNTS_PER_CYCLE;

    return accounts.slice(start, start + ACCOUNTS_PER_CYCLE);
}

/**
 * Poll a single account for new tweets.
 * Returns tweets that are ready for scoring (status='pending').
 */
async function pollSingleAccount(
    env: Env,
    account: TwitterAccount,
    config: TwitterAccountConfig
): Promise<TwitterTweet[]> {
    // New account — set baseline without processing any tweets
    if (!account.last_tweet_id) {
        const { newestId } = await getUserTweets(env, account.user_id!, undefined, 5);
        if (newestId) {
            await updateTwitterAccount(env, account.id, account.chat_id, { last_tweet_id: newestId });
        }
        console.log(`[poller] @${account.username}: new account, baseline set to ${newestId}`);
        return [];
    }

    const { tweets, newestId, media } = await getUserTweets(
        env,
        account.user_id!,
        account.last_tweet_id
    );

    if (tweets.length === 0) {
        // No new tweets — increment stale_polls for buffered threads
        await incrementStalePolls(env, account);
        // Complete stale threads
        await completeStaleThreads(env, account);
        return [];
    }

    console.log(`[poller] @${account.username}: ${tweets.length} new tweets`);

    // Store tweets and classify as standalone or thread
    const pendingTweets: TwitterTweet[] = [];

    for (const xTweet of tweets) {
        // Skip replies to other people — not worth reposting
        if (isReplyToOther(xTweet, account.user_id!)) {
            console.log(`[poller] @${account.username}: skipping reply to other user (${xTweet.id})`);
            continue;
        }

        const isThreadContinuation = isThreadTweet(xTweet, account.user_id!);
        const tweetUrl = `https://x.com/${account.username}/status/${xTweet.id}`;

        await createTwitterTweet(env, {
            id: xTweet.id,
            account_id: account.id,
            chat_id: account.chat_id,
            conversation_id: xTweet.conversation_id || null,
            thread_position: 0,
            is_thread: isThreadContinuation ? 1 : 0,
            text: xTweet.text,
            author_username: account.username,
            metrics: xTweet.public_metrics ? JSON.stringify(xTweet.public_metrics) : null,
            tweet_url: tweetUrl,
            tweeted_at: xTweet.created_at || null,
            status: isThreadContinuation ? 'buffered' : 'pending',
            media_url: getMediaUrl(media, xTweet),
        });

        if (isThreadContinuation && xTweet.conversation_id) {
            // Add to thread buffer
            await addToThreadBuffer(env, account, xTweet.conversation_id, xTweet.id);
        } else {
            // Standalone tweet — ready for scoring
            const stored = await env.DB.prepare('SELECT * FROM twitter_tweets WHERE id = ?')
                .bind(xTweet.id)
                .first<TwitterTweet>();
            if (stored) pendingTweets.push(stored);
        }
    }

    // Update last_tweet_id
    if (newestId) {
        await updateTwitterAccount(env, account.id, account.chat_id, { last_tweet_id: newestId });
    }

    // Increment stale polls and check for completed threads
    await incrementStalePolls(env, account);
    const completedThreadTweets = await completeStaleThreads(env, account);
    pendingTweets.push(...completedThreadTweets);

    return pendingTweets;
}

/**
 * Check if a tweet is a reply to someone else (not a self-reply/thread).
 * These are conversations with others — not worth reposting.
 */
function isReplyToOther(tweet: XTweet, userId: string): boolean {
    if (!tweet.referenced_tweets) return false;

    const repliedTo = tweet.referenced_tweets.find(r => r.type === 'replied_to');
    if (!repliedTo) return false;

    // Reply to someone else (not self)
    return tweet.in_reply_to_user_id !== userId;
}

/**
 * Determine if a tweet is a thread continuation (self-reply).
 * A thread tweet is one where:
 * - It has a referenced_tweet of type 'replied_to'
 * - The in_reply_to_user_id matches the account's user_id (self-reply)
 */
function isThreadTweet(tweet: XTweet, userId: string): boolean {
    if (!tweet.referenced_tweets) return false;

    const repliedTo = tweet.referenced_tweets.find(r => r.type === 'replied_to');
    if (!repliedTo) return false;

    // If in_reply_to_user_id matches the account user, it's a self-reply (thread)
    return tweet.in_reply_to_user_id === userId;
}

/**
 * Add a tweet to the thread buffer for an account
 */
async function addToThreadBuffer(
    env: Env,
    account: TwitterAccount,
    conversationId: string,
    tweetId: string
): Promise<void> {
    const buffer = parseThreadBuffer(account.thread_buffer);

    if (!buffer[conversationId]) {
        buffer[conversationId] = { tweet_ids: [], stale_polls: 0 };
    }
    buffer[conversationId].tweet_ids.push(tweetId);
    buffer[conversationId].stale_polls = 0; // Reset on new activity

    await updateTwitterAccount(env, account.id, account.chat_id, {
        thread_buffer: JSON.stringify(buffer),
    });
}

/**
 * Increment stale_polls for all buffered threads that didn't get new tweets
 */
async function incrementStalePolls(env: Env, account: TwitterAccount): Promise<void> {
    const buffer = parseThreadBuffer(account.thread_buffer);
    if (Object.keys(buffer).length === 0) return;

    for (const entry of Object.values(buffer)) {
        entry.stale_polls++;
    }

    await updateTwitterAccount(env, account.id, account.chat_id, {
        thread_buffer: JSON.stringify(buffer),
    });

    // Refresh the account's thread_buffer in memory
    account.thread_buffer = JSON.stringify(buffer);
}

/**
 * Complete threads that have been stale for >= 2 polls (30 minutes).
 * Fetches full thread via search, concatenates text, marks as pending.
 */
async function completeStaleThreads(
    env: Env,
    account: TwitterAccount
): Promise<TwitterTweet[]> {
    const buffer = parseThreadBuffer(account.thread_buffer);
    const completedTweets: TwitterTweet[] = [];
    let bufferChanged = false;

    for (const [conversationId, entry] of Object.entries(buffer)) {
        if (entry.stale_polls < 2) continue;

        console.log(`[poller] Thread ${conversationId} stale for ${entry.stale_polls} polls, completing`);

        try {
            // Fetch full thread
            const threadTweets = await searchConversation(env, conversationId, account.username);

            if (threadTweets.length > 0) {
                // Sort by created_at to get correct order
                threadTweets.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));

                // Concatenate thread text
                const fullText = threadTweets.map(t => t.text).join('\n\n---\n\n');

                // Use the first tweet in the conversation as the "main" tweet
                const firstTweet = threadTweets[0];
                const tweetUrl = `https://x.com/${account.username}/status/${firstTweet.id}`;

                // Update the first buffered tweet to contain full thread text
                const mainTweetId = entry.tweet_ids[0] || firstTweet.id;

                // Store/update with full thread content
                await createTwitterTweet(env, {
                    id: mainTweetId,
                    account_id: account.id,
                    chat_id: account.chat_id,
                    conversation_id: conversationId,
                    thread_position: 0,
                    is_thread: 1,
                    text: fullText,
                    author_username: account.username,
                    tweet_url: tweetUrl,
                    tweeted_at: firstTweet.created_at || null,
                    status: 'pending',
                });

                // Update existing buffered tweet to pending with full text
                await updateTwitterTweet(env, mainTweetId, {
                    text: fullText,
                    status: 'pending',
                    is_thread: 1,
                    thread_position: threadTweets.length,
                });

                // Mark other buffered tweets as skipped (consolidated into main)
                for (const tweetId of entry.tweet_ids.slice(1)) {
                    await updateTwitterTweet(env, tweetId, { status: 'skipped' });
                }

                const stored = await env.DB.prepare('SELECT * FROM twitter_tweets WHERE id = ?')
                    .bind(mainTweetId)
                    .first<TwitterTweet>();
                if (stored) completedTweets.push(stored);
            }
        } catch (error) {
            console.error(`[poller] Failed to complete thread ${conversationId}:`, error);
        }

        // Remove from buffer
        delete buffer[conversationId];
        bufferChanged = true;
    }

    if (bufferChanged) {
        await updateTwitterAccount(env, account.id, account.chat_id, {
            thread_buffer: Object.keys(buffer).length > 0 ? JSON.stringify(buffer) : null,
        });
    }

    return completedTweets;
}

/**
 * Parse thread buffer JSON
 */
function parseThreadBuffer(raw: string | null): Record<string, ThreadBufferEntry> {
    if (!raw) return {};
    try {
        return JSON.parse(raw);
    } catch {
        return {};
    }
}
