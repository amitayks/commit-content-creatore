/**
 * HeyGen Webhook Handler — processes video generation callbacks
 */

import type { Env, HeyGenWebhookPayload } from '../types';
import { getVideoDraftByHeygenId, updateVideoDraft } from '../services/db';
import { downloadVideo } from '../services/heygen';
import { storeVideo } from '../services/storage';
import { sendMessage, sendVideo } from '../services/telegram';
import { logInfo, logError, secureJsonResponse, secureErrorResponse } from '../services/security';

export async function handleHeyGenWebhook(request: Request, env: Env): Promise<Response> {
    try {
        const payload = await request.json() as HeyGenWebhookPayload;
        const videoId = payload.event_data?.video_id;

        if (!videoId) {
            logError('HeyGen webhook: missing video_id');
            return secureJsonResponse({ error: 'Missing video_id' }, 400);
        }

        // Lookup the draft by HeyGen video ID
        const draft = await getVideoDraftByHeygenId(env, videoId);
        if (!draft) {
            logError('HeyGen webhook: no draft found for video_id:', videoId);
            return secureJsonResponse({ error: 'Unknown video_id' }, 400);
        }

        if (draft.status !== 'generating') {
            logInfo('HeyGen webhook: draft not in generating state, skipping:', draft.id, draft.status);
            return secureJsonResponse({ ok: true, skipped: true });
        }

        if (payload.event_type === 'avatar_video.success') {
            await handleVideoSuccess(env, draft.id, draft.chat_id, videoId, payload.event_data.url);
        } else if (payload.event_type === 'avatar_video.fail') {
            await handleVideoFailure(env, draft.id, draft.chat_id, payload.event_data.error);
        }

        return secureJsonResponse({ ok: true });
    } catch (error) {
        logError('HeyGen webhook error:', error instanceof Error ? error.message : String(error));
        return secureErrorResponse(error);
    }
}

/**
 * Handle successful video generation — download, store, notify
 */
async function handleVideoSuccess(
    env: Env,
    draftId: string,
    chatId: string,
    videoId: string,
    videoUrl?: string
): Promise<void> {
    if (!videoUrl) {
        logError('HeyGen success webhook missing video URL for:', videoId);
        await updateVideoDraft(env, draftId, chatId, { status: 'failed' });
        await sendMessage(env, chatId, '❌ Video completed but no download URL was provided.');
        return;
    }

    try {
        // Download from HeyGen (URLs expire in 7 days)
        logInfo('Downloading video from HeyGen:', videoId);
        const { data, contentType } = await downloadVideo(env, videoUrl);

        // Store in R2
        const r2Key = await storeVideo(env, draftId, data, contentType);
        if (!r2Key) {
            throw new Error('Failed to store video in R2');
        }

        // Update draft
        await updateVideoDraft(env, draftId, chatId, {
            status: 'completed',
            video_url: r2Key,
        });

        // Get draft title for caption
        const draft = await getVideoDraftByHeygenId(env, videoId);
        const title = draft?.title || 'Your Video';

        // Build action buttons
        const buttons = [
            [
                { text: '📢 Publish', callback_data: `action:video_publish:${draftId}` },
                { text: '📅 Schedule', callback_data: `action:video_schedule:${draftId}` },
            ],
            [{ text: '🗑 Delete', callback_data: `action:video_delete:${draftId}` }],
            [{ text: '🏠 Home', callback_data: 'view:home' }],
        ];

        // Send the actual video file via public media URL
        const mediaUrl = `${env.WORKER_URL}/media/${r2Key}`;
        const caption = `✅ <b>${title}</b>\n\nYour video is ready! Choose an action:`;

        try {
            await sendVideo(env, chatId, mediaUrl, caption, buttons);
        } catch (videoSendErr) {
            // Fallback to text message if video sending fails (e.g. file too large for Telegram)
            logError('sendVideo failed, falling back to text:', videoSendErr instanceof Error ? videoSendErr.message : String(videoSendErr));
            await sendMessage(env, chatId, caption, [
                ...buttons.slice(0, -1),
                [{ text: '🎬 View Details', callback_data: `view:video_detail:${draftId}` }],
                [{ text: '🏠 Home', callback_data: 'view:home' }],
            ]);
        }

        logInfo('Video completed and stored:', draftId);
    } catch (error) {
        logError('Failed to process completed video:', error instanceof Error ? error.message : String(error));
        await updateVideoDraft(env, draftId, chatId, { status: 'failed' });
        await sendMessage(env, chatId, `❌ Video generation completed but failed to download/store. Please try again.`);
    }
}

/**
 * Handle failed video generation — update status, notify
 */
async function handleVideoFailure(
    env: Env,
    draftId: string,
    chatId: string,
    errorMsg?: string
): Promise<void> {
    await updateVideoDraft(env, draftId, chatId, { status: 'failed' });
    const reason = errorMsg || 'Unknown error';
    await sendMessage(env, chatId,
        `❌ <b>Video Generation Failed</b>\n\nReason: ${reason}\n\nYou can try regenerating the script or adjusting the configuration.`,
        [
            [{ text: '🔄 View Draft', callback_data: `view:video_detail:${draftId}` }],
            [{ text: '🏠 Home', callback_data: 'view:home' }],
        ]
    );
    logInfo('Video generation failed:', draftId, reason);
}

