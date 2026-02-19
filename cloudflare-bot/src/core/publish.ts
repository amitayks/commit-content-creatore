/**
 * Shared publish pipeline — image gen → upload → post → DB record
 */

import type { Env, Draft, DraftContent } from '../types';
import { generateImage } from '../services/gemini';
import { postThread, postQuoteTweet, uploadMediaFromBuffer, uploadMedia } from '../services/x';
import { updateDraftStatus, createPublished } from '../services/db';

export interface PublishResult {
    success: true;
    url: string;
    tweetIds: string[];
}

/**
 * Publish a single draft: get/generate image → upload media → post thread → update DB
 * Throws on failure (callers handle their own error UI).
 */
export async function publishDraft(
    env: Env,
    chatId: string,
    draft: Draft
): Promise<PublishResult> {
    const content = JSON.parse(draft.content) as DraftContent;

    // Check if any tweets have per-tweet media (handwritten drafts)
    const hasPerTweetMedia = content.tweets.some(t => t.mediaKey);

    let mediaId: string | undefined;
    let perTweetMediaIds: (string | null)[] | undefined;

    try {
        if (hasPerTweetMedia) {
            // Per-tweet media: upload each tweet's media individually
            perTweetMediaIds = await Promise.all(
                content.tweets.map(async (tweet) => {
                    if (!tweet.mediaKey) return null;
                    try {
                        const r2Object = await env.IMAGES.get(tweet.mediaKey);
                        if (!r2Object) {
                            console.error('R2 object not found for mediaKey:', tweet.mediaKey);
                            return null;
                        }
                        const buffer = await r2Object.arrayBuffer();
                        return await uploadMediaFromBuffer(env, buffer);
                    } catch (err) {
                        console.error('Failed to upload per-tweet media:', tweet.mediaKey, err);
                        return null;
                    }
                })
            );
        } else {
            // Legacy: draft-level image for auto-generated drafts
            if (draft.image_url && draft.image_url.startsWith('drafts/')) {
                const r2Object = await env.IMAGES.get(draft.image_url);
                if (r2Object) {
                    console.log('Reading image directly from R2...');
                    const imageBuffer = await r2Object.arrayBuffer();
                    mediaId = await uploadMediaFromBuffer(env, imageBuffer);
                }
            } else if (draft.image_url) {
                mediaId = await uploadMedia(env, draft.image_url);
            }

            // Generate image if none exists (skip for handwritten drafts without imagePrompt)
            if (!mediaId && (draft.source !== 'handwrite' || content.imagePrompt)) {
                console.log('No image available, generating...');
                const imageResult = await generateImage(env, content);
                if (imageResult) {
                    mediaId = await uploadMediaFromBuffer(env, imageResult.data);
                }
            }
        }
    } catch (mediaError) {
        console.error('Media upload failed, continuing without image:',
            mediaError instanceof Error ? mediaError.message : String(mediaError));
        mediaId = undefined;
        perTweetMediaIds = undefined;
    }

    // Post as quote tweet if this is a repost draft
    if (draft.source === 'repost' && draft.original_tweet_id) {
        const firstTweetText = content.tweets[0]?.text || '';
        const mediaIds = mediaId ? [mediaId] : undefined;
        const quoteTweetId = await postQuoteTweet(env, firstTweetText, draft.original_tweet_id, { mediaIds });
        const url = `https://x.com/i/status/${quoteTweetId}`;

        await updateDraftStatus(env, draft.id, chatId, 'published');
        await createPublished(env, chatId, {
            draft_id: draft.id,
            pr_number: draft.pr_number,
            tweet_ids: [quoteTweetId],
            tweet_url: url,
            image_url: draft.image_url || undefined,
        });

        return { success: true, url, tweetIds: [quoteTweetId] };
    }

    // Post thread (with or without media)
    const { tweetIds, url } = await postThread(env, content, mediaId, perTweetMediaIds);

    // Update status and create published record
    await updateDraftStatus(env, draft.id, chatId, 'published');
    await createPublished(env, chatId, {
        draft_id: draft.id,
        pr_number: draft.pr_number,
        tweet_ids: tweetIds,
        tweet_url: url,
        image_url: draft.image_url || undefined,
    });

    return { success: true, url, tweetIds };
}
