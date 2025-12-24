/**
 * Callback Handler - Process button clicks
 * 
 * Key pattern: Button clicks EDIT the current message (silent UI update)
 */

import type { Env, TelegramCallbackQuery, DraftContent } from '../types';
import { editMessage, answerCallback } from '../services/telegram';
import { getChatState, updateChatState, parseContext, getDraft, updateDraftStatus, scheduleDraft, deleteDraft, getAllDrafts, createPublished, getRepo, updateRepo, deleteRepo } from '../services/db';
import { generateContent, generateImage } from '../services/grok';
import { getContentSource } from '../services/github';
import { postThread, uploadMedia } from '../services/x';
import { deleteWebhook } from '../services/webhook';
import { parseRepoConfig } from '../services/db';
import {
    renderHome,
    renderDraftsList,
    renderDraftDetail,
    renderHelp,
    renderGeneratePrompt,
    renderSchedulePrompt,
    renderDeletePrompt,
    renderError,
    renderSuccess,
    renderPublishing,
    renderReposList,
    renderRepoDetail,
    renderAddRepo,
    renderDeleteRepoConfirm,
    renderRepoConfig,
} from '../views/index';

/**
 * Handle callback query (button click)
 * 
 * Button clicks ALWAYS edit the current message (silent UI update)
 */
export async function handleCallback(
    env: Env,
    callback: TelegramCallbackQuery
): Promise<void> {
    if (!callback.message || !callback.data) {
        await answerCallback(env, callback.id);
        return;
    }

    const chatId = String(callback.message.chat.id);
    const messageId = callback.message.message_id;
    const data = callback.data;

    console.log('Processing callback:', chatId, data);

    try {
        // Parse callback data: type:value or type:action:id
        const parts = data.split(':');
        const type = parts[0];
        const value = parts[1];
        const extra = parts[2];

        let view;

        switch (type) {
            case 'view':
                view = await handleViewChange(env, chatId, value);
                break;

            case 'draft':
                view = await renderDraftDetail(env, value);
                await updateChatState(env, chatId, {
                    current_view: 'draft',
                    context: { selected_draft_id: value },
                });
                break;

            case 'action':
                view = await handleAction(env, chatId, value, extra, messageId);
                break;

            case 'page':
                const page = parseInt(value, 10) || 0;
                view = await renderDraftsList(env, page);
                await updateChatState(env, chatId, {
                    current_view: 'drafts',
                    context: { page },
                });
                break;

            case 'repo':
                // View repo detail
                view = await renderRepoDetail(env, value);
                await updateChatState(env, chatId, {
                    current_view: 'repo',
                    context: { selected_repo_id: value },
                });
                break;

            case 'config':
                // Handle config toggle
                view = await handleConfigToggle(env, value, extra);
                break;

            default:
                view = renderHome();
        }

        // Edit the current message with new content
        await editMessage(env, chatId, messageId, view.text, view.keyboard);
        await answerCallback(env, callback.id);
    } catch (error) {
        console.error('Callback handler error:', error);
        const view = renderError(String(error));
        await editMessage(env, chatId, messageId, view.text, view.keyboard);
        await answerCallback(env, callback.id, 'Error occurred');
    }
}

/**
 * Handle view change callbacks
 */
async function handleViewChange(
    env: Env,
    chatId: string,
    view: string
): Promise<{ text: string; keyboard: { text: string; callback_data: string }[][] }> {
    switch (view) {
        case 'home':
            await updateChatState(env, chatId, { current_view: 'home', context: null });
            return renderHome();

        case 'drafts':
            await updateChatState(env, chatId, { current_view: 'drafts', context: { page: 0 } });
            return renderDraftsList(env, 0);

        case 'help':
            await updateChatState(env, chatId, { current_view: 'help', context: null });
            return renderHelp();

        case 'generate':
            await updateChatState(env, chatId, {
                current_view: 'generate',
                context: { awaiting_input: 'commit_sha' },
            });
            return renderGeneratePrompt();

        case 'schedule':
            await updateChatState(env, chatId, {
                current_view: 'schedule',
                context: { awaiting_input: 'schedule' },
            });
            return renderSchedulePrompt();

        case 'delete':
            await updateChatState(env, chatId, {
                current_view: 'delete',
                context: { awaiting_input: 'delete' },
            });
            return renderDeletePrompt();

        case 'repos':
            await updateChatState(env, chatId, { current_view: 'repos', context: null });
            return renderReposList(env);

        default:
            return renderHome();
    }
}

/**
 * Handle action callbacks (approve, reject, publish, etc.)
 */
async function handleAction(
    env: Env,
    chatId: string,
    action: string,
    draftId: string,
    messageId: number
): Promise<{ text: string; keyboard: { text: string; callback_data: string }[][] }> {
    switch (action) {
        case 'approve': {
            await updateDraftStatus(env, draftId, 'approved');
            return renderSuccess(
                '✅ Draft approved!\n\n' +
                'Use 🚀 Publish on the dashboard to publish, or 📅 Schedule for later.'
            );
        }

        case 'reject': {
            await updateDraftStatus(env, draftId, 'rejected');
            return renderSuccess('❌ Draft rejected and archived.');
        }

        case 'publish': {
            // Publish single draft
            const draft = await getDraft(env, draftId);
            if (!draft) {
                return renderError('Draft not found.');
            }

            try {
                const content = JSON.parse(draft.content) as DraftContent;

                // Generate image
                console.log('Starting image generation for publish...');
                const imageUrl = await generateImage(env, content);
                console.log('Image generation result:', imageUrl);

                let mediaId: string | undefined;
                if (imageUrl) {
                    console.log('Uploading image to X...');
                    mediaId = await uploadMedia(env, imageUrl);
                    console.log('Media upload result:', mediaId);
                }

                // Post thread
                console.log('Posting thread with mediaId:', mediaId);
                const { tweetIds, url } = await postThread(env, content, mediaId);

                // Update status and create published record
                await updateDraftStatus(env, draftId, 'published');
                await createPublished(env, {
                    draft_id: draftId,
                    pr_number: draft.pr_number,
                    tweet_ids: tweetIds,
                    tweet_url: url,
                    image_url: imageUrl || undefined,
                });

                return renderSuccess(`📤 Published to X!\n\n${url}`);
            } catch (error) {
                return renderError(`Publishing failed: ${String(error)}`);
            }
        }

        case 'publish_approved': {
            // Publish all approved drafts
            const drafts = await getAllDrafts(env, 'approved');

            if (drafts.length === 0) {
                return renderError('No approved drafts to publish.\n\nApprove some drafts first!');
            }

            const results: string[] = [];

            for (const draft of drafts) {
                try {
                    const content = JSON.parse(draft.content) as DraftContent;

                    const imageUrl = await generateImage(env, content);
                    let mediaId: string | undefined;
                    if (imageUrl) {
                        mediaId = await uploadMedia(env, imageUrl);
                    }

                    const { tweetIds, url } = await postThread(env, content, mediaId);

                    await updateDraftStatus(env, draft.id, 'published');
                    await createPublished(env, {
                        draft_id: draft.id,
                        pr_number: draft.pr_number,
                        tweet_ids: tweetIds,
                        tweet_url: url,
                        image_url: imageUrl || undefined,
                    });

                    results.push(`✅ PR #${draft.pr_number}: ${url}`);
                } catch (error) {
                    results.push(`❌ PR #${draft.pr_number}: ${String(error)}`);
                }
            }

            return renderSuccess(`Published ${results.length} drafts:\n\n${results.join('\n')}`);
        }

        case 'regenerate': {
            const draft = await getDraft(env, draftId);
            if (!draft) {
                return renderError('Draft not found.');
            }

            try {
                const source = await getContentSource(env, draft.commit_sha);
                const newContent = await generateContent(env, source);
                await updateDraftStatus(env, draftId, 'draft'); // Reset to draft
                // Note: Would need updateDraftContent here

                return renderDraftDetail(env, draftId);
            } catch (error) {
                return renderError(`Regeneration failed: ${String(error)}`);
            }
        }

        case 'schedule': {
            // For now, show schedule prompt
            await updateChatState(env, chatId, {
                context: { awaiting_input: 'schedule', selected_draft_id: draftId },
            });
            return {
                text: `📅 <b>Schedule Draft</b>

Send me the datetime to schedule this post.

Format: <code>2024-01-15 14:00</code>`,
                keyboard: [[{ text: '❌ Cancel', callback_data: 'view:drafts' }]],
            };
        }

        case 'unschedule': {
            await updateDraftStatus(env, draftId, 'draft');
            return renderSuccess('Schedule cancelled. Draft returned to pending status.');
        }

        case 'edit': {
            // For now, suggest regenerate
            return {
                text: `✏️ <b>Edit Draft</b>

Direct editing is not yet supported. 

Use 🔄 <b>Regenerate</b> to create fresh content with the same PR data.`,
                keyboard: [
                    [{ text: '🔄 Regenerate', callback_data: `action:regenerate:${draftId}` }],
                    [{ text: '◀️ Back', callback_data: `draft:${draftId}` }],
                ],
            };
        }

        // ==================== REPO ACTIONS ====================

        case 'add_repo': {
            // Show add repo prompt
            await updateChatState(env, chatId, {
                current_view: 'add_repo',
                context: { awaiting_input: 'add_repo' },
            });
            return renderAddRepo();
        }

        case 'watch': {
            // Start watching a repo (draftId is actually repoId)
            const repoId = draftId;
            await updateRepo(env, repoId, { is_watching: 1 });
            return renderRepoDetail(env, repoId);
        }

        case 'unwatch': {
            // Stop watching a repo
            const repoId = draftId;
            await updateRepo(env, repoId, { is_watching: 0 });
            return renderRepoDetail(env, repoId);
        }

        case 'delete_repo': {
            // Show delete confirmation
            const repoId = draftId;
            return renderDeleteRepoConfirm(env, repoId);
        }

        case 'confirm_delete_repo': {
            // Delete the repo
            const repoId = draftId;
            const repo = await getRepo(env, repoId);
            if (!repo) {
                return renderError('Repository not found.');
            }

            // Delete webhook from GitHub if it exists
            if (repo.webhook_id) {
                await deleteWebhook(env, repo.owner, repo.repo, repo.webhook_id);
            }

            await deleteRepo(env, repoId);
            return {
                text: `✅ <b>Repository Deleted</b>

<code>${repo.owner}/${repo.repo}</code> has been removed.${repo.webhook_id ? '\n\nWebhook also removed from GitHub.' : ''}`,
                keyboard: [[{ text: '📦 Repos', callback_data: 'view:repos' }]],
            };
        }

        case 'edit_repo': {
            // Show config editing view
            const repoId = draftId;
            return renderRepoConfig(env, repoId);
        }

        default:
            return renderHome();
    }
}

/**
 * Handle config toggle callbacks
 */
async function handleConfigToggle(
    env: Env,
    setting: string,
    repoId: string
): Promise<{ text: string; keyboard: { text: string; callback_data: string }[][] }> {
    const repo = await getRepo(env, repoId);
    if (!repo) {
        return renderError('Repository not found.');
    }

    const config = parseRepoConfig(repo);

    switch (setting) {
        case 'tone': {
            // Cycle through tones: professional -> casual -> technical -> professional
            const tones = ['professional', 'casual', 'technical'] as const;
            const currentIndex = tones.indexOf(config.tone as typeof tones[number]);
            const nextIndex = (currentIndex + 1) % tones.length;
            config.tone = tones[nextIndex];
            break;
        }
        case 'hashtags': {
            config.includeHashtags = !config.includeHashtags;
            break;
        }
        case 'watchPRs': {
            config.watchPRs = !config.watchPRs;
            break;
        }
        case 'watchPushes': {
            config.watchPushes = !config.watchPushes;
            break;
        }
        default:
            return renderRepoConfig(env, repoId);
    }

    // Save updated config
    await updateRepo(env, repoId, { config });

    // Return updated config view
    return renderRepoConfig(env, repoId);
}

