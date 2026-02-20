/**
 * Cron Handler — Coordinator + Per-User Cron Functions
 *
 * The coordinator finds users with pending work and runs per-user
 * cron tasks inline as parallel promises (no self-fetch fan-out).
 * Each per-user function runs with a hydrated env.
 */

import type { Env, Draft, VideoDraft } from '../types';
import {
    getDueDraftsByUser,
    updateDraftStatus,
    getTimezone,
    getStaleGeneratingDraftsByUser,
    getScheduledVideoDraftsByUser,
    updateVideoDraft,
    createVideoPublished,
} from '../services/db';
import { sendMessage, sendVideo } from '../services/telegram';
import { publishDraft } from '../core/publish';
import { sanitizeError, logInfo, logError } from '../services/security';
import { formatLocalTime } from '../services/timezone';
import { hydrateEnv } from '../services/user-keys';
import { pollUserAccounts } from '../services/poller';

// ==================== COORDINATOR ====================

/**
 * Coordinator — finds active users with pending work and runs cron tasks inline in parallel
 */
export async function cronCoordinator(env: Env, ctx: ExecutionContext): Promise<void> {
    logInfo('[cron] Coordinator starting');

    const result = await env.DB.prepare(`
        SELECT DISTINCT chat_id FROM (
            SELECT chat_id FROM twitter_accounts WHERE is_watching = 1
            UNION
            SELECT chat_id FROM drafts WHERE status = 'scheduled' AND REPLACE(scheduled_at, 'T', ' ') <= datetime('now')
            UNION
            SELECT chat_id FROM video_drafts WHERE status = 'generating' AND updated_at <= datetime('now', '-30 minutes')
            UNION
            SELECT chat_id FROM video_drafts WHERE status = 'scheduled' AND REPLACE(scheduled_at, 'T', ' ') <= datetime('now')
        )
    `).all<{ chat_id: string }>();

    const users = result.results || [];

    if (users.length === 0) {
        logInfo('[cron] No users with pending work');
        return;
    }

    logInfo(`[cron] Processing ${users.length} users inline`);

    // Run all users in parallel — no self-fetch, direct execution
    const results = await Promise.allSettled(
        users.map(user => processUserCron(env, user.chat_id))
    );

    // Log results
    for (let i = 0; i < results.length; i++) {
        const r = results[i];
        const chatId = users[i].chat_id;
        if (r.status === 'rejected') {
            logError(`[cron] User ${chatId} failed:`, r.reason instanceof Error ? r.reason.message : String(r.reason));
        }
    }

    logInfo(`[cron] Completed ${users.length} users`);
}

/**
 * Run all cron tasks for a single user — hydrates env, polls, publishes, etc.
 */
async function processUserCron(env: Env, chatId: string): Promise<void> {
    logInfo(`[cron] Starting per-user cron for chat ${chatId}`);

    const userEnv = await hydrateEnv(env, chatId);

    const results: Record<string, string> = {};

    try {
        await pollUserAccounts(userEnv, chatId);
        results.poller = 'ok';
    } catch (error) {
        logError(`[cron] Poller failed for chat ${chatId}:`, sanitizeError(error));
        results.poller = 'error';
    }

    try {
        await publishUserDrafts(userEnv, chatId);
        results.drafts = 'ok';
    } catch (error) {
        logError(`[cron] Draft publishing failed for chat ${chatId}:`, sanitizeError(error));
        results.drafts = 'error';
    }

    try {
        await checkUserStaleVideos(userEnv, chatId);
        results.staleVideos = 'ok';
    } catch (error) {
        logError(`[cron] Stale video check failed for chat ${chatId}:`, sanitizeError(error));
        results.staleVideos = 'error';
    }

    try {
        await publishUserScheduledVideos(userEnv, chatId);
        results.scheduledVideos = 'ok';
    } catch (error) {
        logError(`[cron] Scheduled video publishing failed for chat ${chatId}:`, sanitizeError(error));
        results.scheduledVideos = 'error';
    }

    logInfo(`[cron] Completed for chat ${chatId}:`, JSON.stringify(results));
}

// ==================== PER-USER CRON FUNCTIONS ====================

/**
 * Publish due scheduled drafts for a specific user
 * Called with already-hydrated env
 */
export async function publishUserDrafts(env: Env, chatId: string): Promise<void> {
    const drafts = await getDueDraftsByUser(env, chatId);

    if (drafts.length === 0) return;

    logInfo(`[cron] Publishing ${drafts.length} scheduled drafts for chat ${chatId}`);

    for (const draft of drafts) {
        let publishResult: { url: string } | null = null;

        try {
            publishResult = await publishDraft(env, chatId, draft);
            logInfo(`[cron] Published scheduled draft: ${draft.id}`);
        } catch (error) {
            logError(`[cron] Failed to publish scheduled draft ${draft.id}:`, sanitizeError(error));

            await updateDraftStatus(env, draft.id, chatId, 'draft');

            try {
                await sendMessage(
                    env,
                    chatId,
                    `⚠️ <b>Scheduled Post Failed</b>\n\n` +
                    `PR #${draft.pr_number}: ${draft.pr_title}\n\n` +
                    `${sanitizeError(error)}\n\n` +
                    `The draft has been returned to pending status.`,
                    [[{ text: '📝 View Drafts', callback_data: 'view:drafts' }]]
                );
            } catch (notifyError) {
                logError('Failed to send error notification:', notifyError);
            }
            continue;
        }

        try {
            const tz = await getTimezone(env, chatId);
            const publishTime = formatLocalTime(new Date().toISOString(), tz);
            await sendMessage(
                env,
                chatId,
                `📤 <b>Scheduled Post Published!</b>\n\n` +
                `PR #${draft.pr_number}: ${draft.pr_title}\n` +
                `🕐 Published ${publishTime}\n\n` +
                `${publishResult.url}`,
                [[{ text: '🏠 Dashboard', callback_data: 'view:home' }]]
            );
        } catch (notifyError) {
            logError('Failed to send publish notification (draft is published):', notifyError);
        }
    }
}

/**
 * Check for stale generating video drafts for a specific user (>30 min)
 * Called with already-hydrated env
 */
export async function checkUserStaleVideos(env: Env, chatId: string): Promise<void> {
    try {
        const staleDrafts = await getStaleGeneratingDraftsByUser(env, chatId, 30);

        for (const draft of staleDrafts) {
            try {
                const { checkVideoStatus, downloadVideo } = await import('../services/heygen');
                const status = await checkVideoStatus(env, draft.heygen_video_id!);

                if (status.status === 'completed' && status.video_url) {
                    const { storeVideo } = await import('../services/storage');
                    const { data, contentType } = await downloadVideo(env, status.video_url);
                    const r2Key = await storeVideo(env, draft.id, data, contentType);

                    await updateVideoDraft(env, draft.id, chatId, {
                        status: 'completed',
                        video_url: r2Key,
                    });

                    const workerUrl = env.WORKER_URL!;
                    const mediaUrl = `${workerUrl}/media/${r2Key}`;
                    const caption = `✅ <b>Video Ready!</b>\n\nYour video has been generated successfully.`;
                    const buttons = [
                        [
                            { text: '📢 Publish', callback_data: `action:video_publish:${draft.id}` },
                            { text: '📅 Schedule', callback_data: `action:video_schedule:${draft.id}` },
                        ],
                        [{ text: '🗑 Delete', callback_data: `action:video_delete:${draft.id}` }],
                        [{ text: '🏠 Home', callback_data: 'view:home' }],
                    ];

                    try {
                        await sendVideo(env, chatId, mediaUrl, caption, buttons);
                    } catch (videoSendErr) {
                        logError('Cron sendVideo failed, falling back to text:', videoSendErr instanceof Error ? videoSendErr.message : String(videoSendErr));
                        await sendMessage(env, chatId, caption, [
                            ...buttons.slice(0, -1),
                            [{ text: '🎬 View Details', callback_data: `view:video_detail:${draft.id}` }],
                            [{ text: '🏠 Home', callback_data: 'view:home' }],
                        ]);
                    }
                } else if (status.status === 'failed') {
                    await updateVideoDraft(env, draft.id, chatId, { status: 'failed' });
                    await sendMessage(env, chatId,
                        `❌ Video generation failed: ${status.error || 'Unknown error'}`,
                        [[{ text: '🔄 View Draft', callback_data: `view:video_detail:${draft.id}` }]]
                    );
                } else {
                    logInfo('Marking stale video as failed:', draft.id);
                    await updateVideoDraft(env, draft.id, chatId, { status: 'failed' });
                    await sendMessage(env, chatId,
                        `❌ Video generation timed out after 30 minutes. Please try again.`,
                        [[{ text: '🔄 View Draft', callback_data: `view:video_detail:${draft.id}` }]]
                    );
                }
            } catch (err) {
                logError('Stale video check error for draft:', draft.id, err instanceof Error ? err.message : String(err));
                await updateVideoDraft(env, draft.id, chatId, { status: 'failed' });
            }
        }
    } catch (error) {
        logError('checkUserStaleVideos error:', error instanceof Error ? error.message : String(error));
    }
}

/**
 * Publish scheduled videos for a specific user when scheduled_at <= NOW()
 * Called with already-hydrated env
 */
export async function publishUserScheduledVideos(env: Env, chatId: string): Promise<void> {
    try {
        const scheduled = await getScheduledVideoDraftsByUser(env, chatId);

        for (const draft of scheduled) {
            if (!draft.scheduled_at) continue;

            const scheduledTime = new Date(draft.scheduled_at.replace(' ', 'T') + (draft.scheduled_at.includes('Z') ? '' : 'Z'));
            if (scheduledTime > new Date()) continue;

            logInfo('Publishing scheduled video:', draft.id);

            try {
                const { publishVideoToTwitter } = await import('../services/video-publish');
                const twitterUrl = await publishVideoToTwitter(env, draft);

                await createVideoPublished(env, chatId, {
                    video_draft_id: draft.id,
                    repo_id: draft.repo_id || undefined,
                    twitter_url: twitterUrl || undefined,
                    caption: draft.caption || undefined,
                });

                await updateVideoDraft(env, draft.id, chatId, { status: 'published' });

                await sendMessage(env, chatId,
                    `📤 <b>Scheduled Video Published!</b>\n\n${draft.title || 'Video'}\n${twitterUrl || 'Published successfully.'}`,
                    [[{ text: '🏠 Home', callback_data: 'view:home' }]]
                );
            } catch (err) {
                logError('Failed to publish scheduled video:', draft.id, err instanceof Error ? err.message : String(err));
                await sendMessage(env, chatId,
                    `⚠️ <b>Scheduled Video Publish Failed</b>\n\n${draft.title || 'Video'}\n\nThe video has been returned to completed status.`,
                    [[{ text: '📋 View', callback_data: `view:video_detail:${draft.id}` }]]
                );
                await updateVideoDraft(env, draft.id, chatId, { status: 'completed' });
            }
        }
    } catch (error) {
        logError('publishUserScheduledVideos error:', error instanceof Error ? error.message : String(error));
    }
}
