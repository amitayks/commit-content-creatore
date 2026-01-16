/**
 * Callback Handler - Process button clicks
 *
 * Key pattern: Button clicks EDIT the current message (silent UI update)
 * SECURITY: All operations verify ownership via chatId
 */

import type { Env, TelegramCallbackQuery, DraftContent } from '../types';
import { editMessage, answerCallback, sendPhoto, deleteMessage, sendMessage } from '../services/telegram';
import { getChatState, updateChatState, parseContext, getDraft, updateDraftStatus, scheduleDraft, deleteDraft, getAllDrafts, createPublished, getRepo, updateRepo, deleteRepo, updateDraft } from '../services/db';
import { generateContent, generateImage, ensureImage } from '../services/grok';
import { getContentSource } from '../services/github';
import { postThread, uploadMedia, uploadMediaFromBuffer } from '../services/x';
import { deleteWebhook } from '../services/webhook';
import { parseRepoConfig } from '../services/db';
import { sanitizeError } from '../services/security';
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

            case 'draft': {
                // Fetch draft and ensure it has an image
                const draft = await getDraft(env, value, chatId);
                if (!draft) {
                    view = renderError('Draft not found.');
                    break;
                }

                // Generate image on-demand if needed
                let imageUrl: string | null = null;
                try {
                    imageUrl = await ensureImage(env, chatId, draft);
                } catch (imgError) {
                    console.error('Image generation failed:', sanitizeError(imgError));
                }

                // Get the view with buttons
                view = await renderDraftDetail(env, chatId, value);

                // Update state
                await updateChatState(env, chatId, {
                    current_view: 'draft',
                    context: { selected_draft_id: value },
                });

                // If we have an image, we need to send a new photo message instead of editing
                // because Telegram can't convert text message to photo
                if (imageUrl) {
                    // Delete old message and send new one with photo
                    try {
                        await deleteMessage(env, chatId, messageId);
                    } catch {
                        // Ignore delete errors
                    }
                    // Build full URL for Telegram
                    const fullImageUrl = `https://content-bot.keisarcontentcreator.workers.dev${imageUrl}`;
                    // Truncate text as caption (1024 limit)
                    const caption = view.text.length > 1000
                        ? view.text.substring(0, 997) + '...'
                        : view.text;
                    await sendPhoto(env, chatId, fullImageUrl, caption, view.keyboard);
                    return;
                }
                break;
            }

            case 'action':
                view = await handleAction(env, chatId, value, extra, messageId);
                break;

            case 'page':
                const page = parseInt(value, 10) || 0;
                view = await renderDraftsList(env, chatId, page);
                await updateChatState(env, chatId, {
                    current_view: 'drafts',
                    context: { page },
                });
                break;

            case 'repo':
                // View repo detail
                view = await renderRepoDetail(env, chatId, value);
                await updateChatState(env, chatId, {
                    current_view: 'repo',
                    context: { selected_repo_id: value },
                });
                break;

            case 'config':
                // Handle config toggle
                view = await handleConfigToggle(env, chatId, value, extra);
                break;

            default:
                view = renderHome();
        }

        // Check if current message is a photo (Telegram includes 'photo' field)
        // Photo messages can't be edited to text, so delete and send new
        const isPhotoMessage = 'photo' in callback.message;

        if (isPhotoMessage) {
            // Delete photo message and send new text message
            try {
                await deleteMessage(env, chatId, messageId);
            } catch {
                // Ignore delete errors
            }
            await sendMessage(env, chatId, view.text, view.keyboard);
        } else {
            // Normal text message - can edit
            await editMessage(env, chatId, messageId, view.text, view.keyboard);
        }
        await answerCallback(env, callback.id);
    } catch (error) {
        console.error('Callback handler error:', sanitizeError(error));
        const view = renderError('An error occurred. Please try again.');
        try {
            await editMessage(env, chatId, messageId, view.text, view.keyboard);
        } catch {
            await sendMessage(env, chatId, view.text, view.keyboard);
        }
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
            return renderDraftsList(env, chatId, 0);

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
            return renderReposList(env, chatId);

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
            await updateDraftStatus(env, draftId, chatId, 'approved');
            return renderSuccess(
                '✅ Draft approved!\n\n' +
                'Use 🚀 Publish on the dashboard to publish, or 📅 Schedule for later.'
            );
        }

        case 'reject': {
            await updateDraftStatus(env, draftId, chatId, 'rejected');
            return renderSuccess('❌ Draft rejected and archived.');
        }

        case 'publish': {
            // Publish single draft
            const draft = await getDraft(env, draftId, chatId);
            if (!draft) {
                return renderError('Draft not found.');
            }

            try {
                const content = JSON.parse(draft.content) as DraftContent;

                let mediaId: string | undefined;

                console.log('Publishing draft, image_url:', draft.image_url);

                // Check if draft already has an image stored in R2
                if (draft.image_url && draft.image_url.startsWith('drafts/')) {
                    // It's an R2 key - read directly from R2 (can't fetch our own worker URL)
                    const r2Object = await env.IMAGES.get(draft.image_url);
                    console.log('R2 object exists:', !!r2Object);
                    if (r2Object) {
                        console.log('Reading image directly from R2...');
                        const imageBuffer = await r2Object.arrayBuffer();
                        console.log('Uploading image to X from R2 buffer...');
                        mediaId = await uploadMediaFromBuffer(env, imageBuffer);
                        console.log('Media upload result:', mediaId);
                    }
                } else if (draft.image_url) {
                    // Already a URL - fetch and upload
                    console.log('Using existing URL:', draft.image_url);
                    mediaId = await uploadMedia(env, draft.image_url);
                    console.log('Media upload result:', mediaId);
                }

                // Generate image if none exists
                if (!mediaId) {
                    console.log('No image available, generating...');
                    const imageUrl = await generateImage(env, content);
                    if (imageUrl) {
                        console.log('Uploading generated image to X...');
                        mediaId = await uploadMedia(env, imageUrl);
                        console.log('Media upload result:', mediaId);
                    }
                }

                // Post thread
                console.log('Posting thread with mediaId:', mediaId);
                const { tweetIds, url } = await postThread(env, content, mediaId);

                // Update status and create published record
                await updateDraftStatus(env, draftId, chatId, 'published');
                await createPublished(env, chatId, {
                    draft_id: draftId,
                    pr_number: draft.pr_number,
                    tweet_ids: tweetIds,
                    tweet_url: url,
                    image_url: draft.image_url || undefined,
                });

                return renderSuccess(`📤 Published to X!\n\n${url}`);
            } catch (error) {
                return renderError(`Publishing failed. Please try again.`);
            }
        }

        case 'publish_approved': {
            // Publish all approved drafts
            const drafts = await getAllDrafts(env, chatId, 'approved');

            if (drafts.length === 0) {
                return renderError('No approved drafts to publish.\n\nApprove some drafts first!');
            }

            const results: string[] = [];

            for (const draft of drafts) {
                try {
                    const content = JSON.parse(draft.content) as DraftContent;

                    let mediaId: string | undefined;

                    // Check if draft already has an image stored in R2
                    if (draft.image_url && draft.image_url.startsWith('drafts/')) {
                        const r2Object = await env.IMAGES.get(draft.image_url);
                        if (r2Object) {
                            console.log('Reading R2 image for batch publish:', draft.image_url);
                            const imageBuffer = await r2Object.arrayBuffer();
                            mediaId = await uploadMediaFromBuffer(env, imageBuffer);
                        }
                    } else if (draft.image_url) {
                        mediaId = await uploadMedia(env, draft.image_url);
                    }

                    // Generate image if none exists
                    if (!mediaId) {
                        console.log('No R2 image, generating for batch publish...');
                        const imageUrl = await generateImage(env, content);
                        if (imageUrl) {
                            mediaId = await uploadMedia(env, imageUrl);
                        }
                    }

                    const { tweetIds, url } = await postThread(env, content, mediaId);

                    await updateDraftStatus(env, draft.id, chatId, 'published');
                    await createPublished(env, chatId, {
                        draft_id: draft.id,
                        pr_number: draft.pr_number,
                        tweet_ids: tweetIds,
                        tweet_url: url,
                        image_url: draft.image_url || undefined,
                    });

                    results.push(`✅ PR #${draft.pr_number}: ${url}`);
                } catch (error) {
                    results.push(`❌ PR #${draft.pr_number}: Publishing failed`);
                }
            }

            return renderSuccess(`Published ${results.length} drafts:\n\n${results.join('\n')}`);
        }

        case 'regenerate': {
            const draft = await getDraft(env, draftId, chatId);
            if (!draft) {
                return renderError('Draft not found.');
            }

            try {
                const source = await getContentSource(env, draft.commit_sha);
                const newContent = await generateContent(env, source);
                await updateDraftStatus(env, draftId, chatId, 'draft'); // Reset to draft
                // Note: Would need updateDraftContent here

                return renderDraftDetail(env, chatId, draftId);
            } catch (error) {
                return renderError('Regeneration failed. Please try again.');
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
            await updateDraftStatus(env, draftId, chatId, 'draft');
            return renderSuccess('Schedule cancelled. Draft returned to pending status.');
        }

        case 'edit': {
            // Set awaiting input for edit instructions
            await updateChatState(env, chatId, {
                context: {
                    awaiting_input: 'edit_draft',
                    selected_draft_id: draftId
                },
            });

            return {
                text: `✏️ <b>Edit Draft</b>

What changes would you like to make?

<i>Examples:</i>
• "Make it more casual"
• "Add more technical details"
• "Focus on the performance improvements"
• "Make it shorter"

Type your instructions below:`,
                keyboard: [
                    [{ text: '❌ Cancel', callback_data: `draft:${draftId}` }],
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
            await updateRepo(env, repoId, chatId, { is_watching: 1 });
            return renderRepoDetail(env, chatId, repoId);
        }

        case 'unwatch': {
            // Stop watching a repo
            const repoId = draftId;
            await updateRepo(env, repoId, chatId, { is_watching: 0 });
            return renderRepoDetail(env, chatId, repoId);
        }

        case 'delete_repo': {
            // Show delete confirmation
            const repoId = draftId;
            return renderDeleteRepoConfirm(env, chatId, repoId);
        }

        case 'confirm_delete_repo': {
            // Delete the repo
            const repoId = draftId;
            const repo = await getRepo(env, repoId, chatId);
            if (!repo) {
                return renderError('Repository not found.');
            }

            // Delete webhook from GitHub if it exists
            if (repo.webhook_id) {
                try {
                    await deleteWebhook(env, repo.owner, repo.repo, repo.webhook_id);
                } catch {
                    // Continue even if webhook deletion fails
                }
            }

            await deleteRepo(env, repoId, chatId);
            return {
                text: `✅ <b>Repository Deleted</b>

<code>${repo.owner}/${repo.repo}</code> has been removed.${repo.webhook_id ? '\n\nWebhook also removed from GitHub.' : ''}`,
                keyboard: [[{ text: '📦 Repos', callback_data: 'view:repos' }]],
            };
        }

        case 'edit_repo': {
            // Show config editing view
            const repoId = draftId;
            return renderRepoConfig(env, chatId, repoId);
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
    chatId: string,
    setting: string,
    repoId: string
): Promise<{ text: string; keyboard: { text: string; callback_data: string }[][] }> {
    const repo = await getRepo(env, repoId, chatId);
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
        case 'codeContext': {
            // Cycle through context levels
            const levels = ['metadata', 'with_diff', 'with_files', 'with_content'] as const;
            const currentIndex = levels.indexOf(config.codeContext as typeof levels[number]);
            const nextIndex = (currentIndex + 1) % levels.length;
            config.codeContext = levels[nextIndex];
            break;
        }
        case 'language': {
            // Toggle between en and he
            config.language = config.language === 'en' ? 'he' : 'en';
            break;
        }
        case 'threadImage': {
            config.alwaysGenerateThreadImage = !config.alwaysGenerateThreadImage;
            break;
        }
        case 'singleImage': {
            // Cycle through probabilities: 0 -> 0.3 -> 0.5 -> 0.7 -> 1.0 -> 0
            const probs = [0, 0.3, 0.5, 0.7, 1.0];
            const currentProb = config.singleTweetImageProbability;
            const currentIndex = probs.findIndex(p => Math.abs(p - currentProb) < 0.05);
            const nextIndex = (currentIndex + 1) % probs.length;
            config.singleTweetImageProbability = probs[nextIndex];
            break;
        }
        default:
            return renderRepoConfig(env, chatId, repoId);
    }

    // Save updated config
    await updateRepo(env, repoId, chatId, { config });

    // Return updated config view
    return renderRepoConfig(env, chatId, repoId);
}
