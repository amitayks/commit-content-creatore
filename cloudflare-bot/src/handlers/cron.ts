/**
 * Cron Handler - Publish scheduled drafts
 */

import type { Env, DraftContent } from '../types';
import { getDueDrafts, updateDraftStatus, createPublished } from '../services/db';
import { sendMessage } from '../services/telegram';
import { generateImage } from '../services/grok';
import { postThread, uploadMedia } from '../services/x';
import { sanitizeError } from '../services/security';

/**
 * Publish all scheduled drafts that are due
 */
export async function publishScheduledDrafts(env: Env): Promise<void> {
    console.log('Checking for scheduled drafts...');

    const drafts = await getDueDrafts(env);

    if (drafts.length === 0) {
        console.log('No scheduled drafts due');
        return;
    }

    console.log(`Publishing ${drafts.length} scheduled drafts`);

    for (const draft of drafts) {
        try {
            const content = JSON.parse(draft.content) as DraftContent;

            // Generate image
            const imageUrl = await generateImage(env, content);
            let mediaId: string | undefined;
            if (imageUrl) {
                mediaId = await uploadMedia(env, imageUrl);
            }

            // Post thread
            const { tweetIds, url } = await postThread(env, content, mediaId);

            // Update status and create published record
            // SECURITY: Use chat_id from draft for ownership verification
            await updateDraftStatus(env, draft.id, draft.chat_id, 'published');
            await createPublished(env, draft.chat_id, {
                draft_id: draft.id,
                pr_number: draft.pr_number,
                tweet_ids: tweetIds,
                tweet_url: url,
                image_url: imageUrl || undefined,
            });

            // Notify user
            await sendMessage(
                env,
                env.TELEGRAM_CHAT_ID,
                `📤 <b>Scheduled Post Published!</b>\n\n` +
                `PR #${draft.pr_number}: ${draft.pr_title}\n\n` +
                `${url}`,
                [[{ text: '🏠 Dashboard', callback_data: 'view:home' }]]
            );

            console.log(`Published scheduled draft: ${draft.id}`);
        } catch (error) {
            console.error(`Failed to publish scheduled draft ${draft.id}:`, error);

            // Update status to failed
            // SECURITY: Use chat_id from draft for ownership verification
            await updateDraftStatus(env, draft.id, draft.chat_id, 'draft');

            // Notify user of failure
            // SECURITY: Use sanitized error to prevent information disclosure
            await sendMessage(
                env,
                env.TELEGRAM_CHAT_ID,
                `⚠️ <b>Scheduled Post Failed</b>\n\n` +
                `PR #${draft.pr_number}: ${draft.pr_title}\n\n` +
                `${sanitizeError(error)}\n\n` +
                `The draft has been returned to pending status.`,
                [[{ text: '📝 View Drafts', callback_data: 'view:drafts' }]]
            );
        }
    }
}
