/**
 * Message Handler - Process incoming text messages
 * 
 * Key pattern: Text messages ALWAYS get a NEW message response
 */

import type { Env, TelegramMessage, ChatContext } from '../types';
import { sendMessage } from '../services/telegram';
import { getChatState, updateChatState, parseContext, createDraft, getAllDrafts, updateDraftStatus, createRepo, getRepoByOwnerRepo, updateRepo } from '../services/db';
import { getContentSource, validateRepo } from '../services/github';
import { generateContent, generateImage } from '../services/grok';
import { postThread, uploadMedia } from '../services/x';
import { createWebhook } from '../services/webhook';
import {
    renderHome,
    renderDraftsList,
    renderHelp,
    renderGeneratePrompt,
    renderSchedulePrompt,
    renderDeletePrompt,
    renderGenerating,
    renderDraftDetail,
    renderError,
    renderSuccess,
    renderPublishing,
    renderReposList,
    renderRepoDetail,
    renderAddRepo,
} from '../views/index';

/**
 * Handle incoming text message
 * 
 * Text messages ALWAYS result in a NEW message response (conversational flow)
 */
export async function handleMessage(env: Env, message: TelegramMessage): Promise<void> {
    const chatId = String(message.chat.id);
    const text = message.text?.trim() || '';

    console.log('Processing message:', chatId, text);

    try {
        // Get current state
        const state = await getChatState(env, chatId);
        const context = parseContext(state);

        // Check if we're awaiting input
        if (context.awaiting_input) {
            await handleAwaitingInput(env, chatId, text, context);
            return;
        }

        // Parse command
        if (text.startsWith('/')) {
            await handleCommand(env, chatId, text);
            return;
        }

        // Default: show home
        const view = renderHome();
        const messageId = await sendMessage(env, chatId, view.text, view.keyboard);
        await updateChatState(env, chatId, {
            message_id: messageId,
            current_view: 'home',
            context: null,
        });
    } catch (error) {
        console.error('Message handler error:', error);
        const view = renderError(String(error));
        await sendMessage(env, chatId, view.text, view.keyboard);
    }
}

/**
 * Handle awaiting input scenarios
 */
async function handleAwaitingInput(
    env: Env,
    chatId: string,
    text: string,
    context: ChatContext
): Promise<void> {
    switch (context.awaiting_input) {
        case 'commit_sha':
            await handleGenerateInput(env, chatId, text);
            break;
        case 'schedule':
            await handleScheduleInput(env, chatId, text);
            break;
        case 'delete':
            await handleDeleteInput(env, chatId, text);
            break;
        case 'add_repo':
            await handleAddRepoInput(env, chatId, text);
            break;
        default:
            // Unknown state, reset to home
            const view = renderHome();
            const messageId = await sendMessage(env, chatId, view.text, view.keyboard);
            await updateChatState(env, chatId, {
                message_id: messageId,
                current_view: 'home',
                context: null,
            });
    }
}

/**
 * Handle slash commands
 */
async function handleCommand(env: Env, chatId: string, text: string): Promise<void> {
    const parts = text.split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ');

    switch (command) {
        case '/start': {
            const view = renderHome();
            const messageId = await sendMessage(env, chatId, view.text, view.keyboard);
            await updateChatState(env, chatId, {
                message_id: messageId,
                current_view: 'home',
                context: null,
            });
            break;
        }

        case '/generate': {
            if (args) {
                // Direct generate with SHA
                await handleGenerateInput(env, chatId, args);
            } else {
                // Prompt for SHA
                const view = renderGeneratePrompt();
                const messageId = await sendMessage(env, chatId, view.text, view.keyboard);
                await updateChatState(env, chatId, {
                    message_id: messageId,
                    current_view: 'generate',
                    context: { awaiting_input: 'commit_sha' },
                });
            }
            break;
        }

        case '/approve': {
            await handlePublishApproved(env, chatId);
            break;
        }

        case '/drafts': {
            const view = await renderDraftsList(env, 0);
            const messageId = await sendMessage(env, chatId, view.text, view.keyboard);
            await updateChatState(env, chatId, {
                message_id: messageId,
                current_view: 'drafts',
                context: { page: 0 },
            });
            break;
        }

        case '/help': {
            const view = renderHelp();
            const messageId = await sendMessage(env, chatId, view.text, view.keyboard);
            await updateChatState(env, chatId, {
                message_id: messageId,
                current_view: 'help',
                context: null,
            });
            break;
        }

        case '/schedule': {
            if (args) {
                await handleScheduleInput(env, chatId, args);
            } else {
                const view = renderSchedulePrompt();
                const messageId = await sendMessage(env, chatId, view.text, view.keyboard);
                await updateChatState(env, chatId, {
                    message_id: messageId,
                    current_view: 'schedule',
                    context: { awaiting_input: 'schedule' },
                });
            }
            break;
        }

        case '/delete': {
            if (args) {
                await handleDeleteInput(env, chatId, args);
            } else {
                const view = renderDeletePrompt();
                const messageId = await sendMessage(env, chatId, view.text, view.keyboard);
                await updateChatState(env, chatId, {
                    message_id: messageId,
                    current_view: 'delete',
                    context: { awaiting_input: 'delete' },
                });
            }
            break;
        }

        case '/repos': {
            const view = await renderReposList(env);
            const messageId = await sendMessage(env, chatId, view.text, view.keyboard);
            await updateChatState(env, chatId, {
                message_id: messageId,
                current_view: 'repos',
                context: null,
            });
            break;
        }

        case '/watch': {
            if (args) {
                // Direct watch with owner/repo
                await handleAddRepoInput(env, chatId, args);
            } else {
                // Prompt for repo
                const view = renderAddRepo();
                const messageId = await sendMessage(env, chatId, view.text, view.keyboard);
                await updateChatState(env, chatId, {
                    message_id: messageId,
                    current_view: 'add_repo',
                    context: { awaiting_input: 'add_repo' },
                });
            }
            break;
        }

        default: {
            // Unknown command, show home
            const view = renderHome();
            const messageId = await sendMessage(env, chatId, view.text, view.keyboard);
            await updateChatState(env, chatId, {
                message_id: messageId,
                current_view: 'home',
                context: null,
            });
        }
    }
}

/**
 * Handle generate input (commit SHA)
 */
async function handleGenerateInput(env: Env, chatId: string, sha: string): Promise<void> {
    // Clear awaiting state
    await updateChatState(env, chatId, { context: null });

    // Send "generating" message
    const genView = renderGenerating(sha);
    const messageId = await sendMessage(env, chatId, genView.text, genView.keyboard);

    try {
        // Get content source (tries PR first, falls back to direct commit)
        const source = await getContentSource(env, sha.substring(0, 7));

        // Determine PR number/title based on source type
        const prNumber = source.type === 'pr' ? source.data.number : 0;
        const prTitle = source.type === 'pr' ? source.data.title : source.data.title;

        // Generate content
        const content = await generateContent(env, source);

        // Save draft
        const draftId = await createDraft(env, {
            pr_number: prNumber,
            pr_title: prTitle,
            commit_sha: sha,
            content: JSON.stringify(content),
        });

        // Show draft preview
        const view = await renderDraftDetail(env, draftId);
        await sendMessage(env, chatId, view.text, view.keyboard);
        await updateChatState(env, chatId, {
            message_id: messageId,
            current_view: 'draft',
            context: { selected_draft_id: draftId },
        });
    } catch (error) {
        console.error('Generate error:', error);
        const view = renderError(String(error));
        await sendMessage(env, chatId, view.text, view.keyboard);
    }
}

/**
 * Handle schedule input (sha + datetime)
 */
async function handleScheduleInput(env: Env, chatId: string, input: string): Promise<void> {
    await updateChatState(env, chatId, { context: null });

    const parts = input.split(' ');
    const sha = parts[0];
    const datetime = parts.slice(1).join(' ');

    if (!sha || !datetime) {
        const view = renderError('Please provide both commit SHA and datetime.\n\nExample: abc1234 2024-01-15 14:00');
        await sendMessage(env, chatId, view.text, view.keyboard);
        return;
    }

    try {
        // Parse datetime
        const scheduledAt = new Date(datetime);
        if (isNaN(scheduledAt.getTime())) {
            const view = renderError('Invalid datetime format. Use: YYYY-MM-DD HH:MM');
            await sendMessage(env, chatId, view.text, view.keyboard);
            return;
        }

        // Generate content
        const source = await getContentSource(env, sha);
        const prNumber = source.type === 'pr' ? source.data.number : 0;
        const prTitle = source.type === 'pr' ? source.data.title : source.data.title;

        const content = await generateContent(env, source);

        // Save as scheduled draft
        await createDraft(env, {
            pr_number: prNumber,
            pr_title: prTitle,
            commit_sha: sha,
            content: JSON.stringify(content),
        });

        const sourceLabel = source.type === 'pr' ? `PR #${prNumber}` : `commit ${sha.substring(0, 7)}`;
        const view = renderSuccess(
            `📅 Scheduled post for ${sourceLabel}\n\n` +
            `Will publish on ${scheduledAt.toLocaleDateString()} at ${scheduledAt.toLocaleTimeString()}`
        );
        await sendMessage(env, chatId, view.text, view.keyboard);
    } catch (error) {
        const view = renderError(String(error));
        await sendMessage(env, chatId, view.text, view.keyboard);
    }
}

/**
 * Handle delete input (commit SHA)
 */
async function handleDeleteInput(env: Env, chatId: string, sha: string): Promise<void> {
    await updateChatState(env, chatId, { context: null });

    // TODO: Implement delete search
    const view = renderError('Delete functionality coming soon.');
    await sendMessage(env, chatId, view.text, view.keyboard);
}

/**
 * Handle add repo input (owner/repo)
 */
async function handleAddRepoInput(env: Env, chatId: string, input: string): Promise<void> {
    await updateChatState(env, chatId, { context: null });

    // Parse owner/repo format
    const parts = input.trim().split('/');
    if (parts.length !== 2) {
        const view = {
            text: `❌ <b>Invalid Format</b>

Please use the format: <code>owner/repo</code>

Example: <code>ozkeisar/work-content-tracker</code>`,
            keyboard: [[{ text: '🔄 Try again', callback_data: 'action:add_repo' }]],
        };
        const messageId = await sendMessage(env, chatId, view.text, view.keyboard);
        await updateChatState(env, chatId, { message_id: messageId, current_view: 'repos' });
        return;
    }

    const [owner, repo] = parts;

    try {
        // Check if already exists
        const existing = await getRepoByOwnerRepo(env, owner, repo);
        if (existing) {
            const view = await renderRepoDetail(env, existing.id);
            const messageId = await sendMessage(
                env,
                chatId,
                `⚠️ <b>Already Watching</b>

<code>${owner}/${repo}</code> is already in your list!

${view.text}`,
                view.keyboard
            );
            await updateChatState(env, chatId, {
                message_id: messageId,
                current_view: 'repo',
                context: { selected_repo_id: existing.id },
            });
            return;
        }

        // Validate repo exists on GitHub
        const isValid = await validateRepo(env, owner, repo);
        if (!isValid) {
            const view = {
                text: `❌ <b>Repository Not Found</b>

<code>${owner}/${repo}</code> does not exist or is not accessible.

Make sure:
• The repository exists
• Your GitHub token has access to it`,
                keyboard: [[{ text: '🔄 Try again', callback_data: 'action:add_repo' }]],
            };
            const messageId = await sendMessage(env, chatId, view.text, view.keyboard);
            await updateChatState(env, chatId, { message_id: messageId, current_view: 'repos' });
            return;
        }

        // Create the repo first
        const repoId = await createRepo(env, { owner, repo });

        // Create GitHub webhook
        const workerUrl = 'https://content-bot.keisarcontentcreator.workers.dev';
        const webhookId = await createWebhook(env, owner, repo, workerUrl);

        let webhookStatus = '';
        if (webhookId) {
            // Update repo with webhook ID
            await updateRepo(env, repoId, { webhook_id: webhookId });
            webhookStatus = '\n\n✅ Webhook created successfully!';
        } else {
            webhookStatus = '\n\n⚠️ Webhook creation failed. Auto-detection may not work.\nCheck that your GITHUB_TOKEN has admin:repo_hook scope.';
        }

        // Show success with repo detail
        const view = await renderRepoDetail(env, repoId);
        const messageId = await sendMessage(
            env,
            chatId,
            `✅ <b>Repository Added!</b>

<code>${owner}/${repo}</code> is now being watched.${webhookStatus}

${view.text}`,
            view.keyboard
        );
        await updateChatState(env, chatId, {
            message_id: messageId,
            current_view: 'repo',
            context: { selected_repo_id: repoId },
        });
    } catch (error) {
        console.error('Error adding repo:', error);
        const view = renderError(`Failed to add repository: ${String(error)}`);
        await sendMessage(env, chatId, view.text, view.keyboard);
    }
}

/**
 * Handle publishing all approved drafts
 */
async function handlePublishApproved(env: Env, chatId: string): Promise<void> {
    try {
        const drafts = await getAllDrafts(env, 'approved');

        if (drafts.length === 0) {
            const view = renderError('No approved drafts to publish.\n\nApprove some drafts first!');
            await sendMessage(env, chatId, view.text, view.keyboard);
            return;
        }

        // Send publishing message
        const pubView = renderPublishing(drafts.length);
        await sendMessage(env, chatId, pubView.text, pubView.keyboard);

        const results: string[] = [];

        for (const draft of drafts) {
            try {
                const content = JSON.parse(draft.content);

                // Generate image
                const imageUrl = await generateImage(env, content);
                let mediaId: string | undefined;
                if (imageUrl) {
                    mediaId = await uploadMedia(env, imageUrl);
                }

                // Post thread
                const { url } = await postThread(env, content, mediaId);

                // Update status
                await updateDraftStatus(env, draft.id, 'published');

                results.push(`✅ PR #${draft.pr_number}: ${url}`);
            } catch (error) {
                results.push(`❌ PR #${draft.pr_number}: ${String(error)}`);
            }
        }

        const view = renderSuccess(`Published ${drafts.length} drafts:\n\n${results.join('\n')}`);
        await sendMessage(env, chatId, view.text, view.keyboard);
    } catch (error) {
        const view = renderError(String(error));
        await sendMessage(env, chatId, view.text, view.keyboard);
    }
}
