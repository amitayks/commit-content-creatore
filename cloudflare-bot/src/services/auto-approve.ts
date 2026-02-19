/**
 * Auto-Approve Flow — For accounts with autoApprove enabled
 *
 * After scoring, generates repost content and creates drafts with status='approved'
 * for tweets that score above the threshold on auto-approve accounts.
 */

import type { Env, TwitterAccount, TwitterTweet } from '../types';
import { parseTwitterAccountConfig, updateTwitterTweet, createDraft } from './db';

/**
 * Process auto-approve for accounts that have it enabled
 */
export async function processAutoApprove(env: Env, accounts: TwitterAccount[]): Promise<void> {
    for (const account of accounts) {
        const config = parseTwitterAccountConfig(account);
        if (!config.autoApprove) continue;

        try {
            // Get scored tweets above threshold that don't have drafts yet
            const result = await env.DB.prepare(
                "SELECT * FROM twitter_tweets WHERE account_id = ? AND status = 'scored' AND draft_id IS NULL ORDER BY relevance_score DESC"
            )
                .bind(account.id)
                .all<TwitterTweet>();

            const scoredTweets = (result.results || []).filter(
                t => t.relevance_score !== null && t.relevance_score >= config.relevanceThreshold
            );

            if (scoredTweets.length === 0) continue;

            console.log(`[auto-approve] @${account.username}: ${scoredTweets.length} tweets to auto-generate`);

            for (const tweet of scoredTweets) {
                try {
                    await generateAndApproveDraft(env, tweet, account, config);
                } catch (error) {
                    console.error(`[auto-approve] Failed for tweet ${tweet.id}:`, error);
                }
            }
        } catch (error) {
            console.error(`[auto-approve] Error processing @${account.username}:`, error);
        }
    }
}

/**
 * Generate repost content and create an approved draft
 */
async function generateAndApproveDraft(
    env: Env,
    tweet: TwitterTweet,
    account: TwitterAccount,
    config: import('../types').TwitterAccountConfig
): Promise<void> {
    const { generateRepostContent } = await import('./repost-generate');

    const imageUrl = config.analyzeMedia ? tweet.media_url : null;
    // Pass undefined for personaOverride — lets repost-generate fetch from account overview
    const content = await generateRepostContent(env, tweet, account.id, config, undefined, imageUrl);
    if (!content) {
        console.error(`[auto-approve] No content generated for tweet ${tweet.id}`);
        return;
    }

    const tweetPreview = tweet.text.substring(0, 30).replace(/\n/g, ' ');
    const draftId = await createDraft(env, account.chat_id, {
        pr_number: 0,
        pr_title: `@${account.username} | ${tweetPreview}...`,
        commit_sha: tweet.id,
        source: 'repost',
        status: 'approved',
        content: JSON.stringify(content),
        original_tweet_id: tweet.id,
        original_tweet_url: tweet.tweet_url || undefined,
    });

    await updateTwitterTweet(env, tweet.id, {
        status: 'drafted',
        draft_id: draftId,
    });

    console.log(`[auto-approve] Created approved draft ${draftId} for tweet ${tweet.id}`);
}
