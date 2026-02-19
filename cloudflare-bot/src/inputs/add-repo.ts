import type { HandlerContext } from '../core/router';
import type { ChatContext } from '../types';
import { respond } from '../core/respond';
import { updateChatState, createRepo, getRepoByOwnerRepo, updateRepo, upsertRepoOverview } from '../services/db';
import { validateRepo, fetchRepoReadme, fetchRecentMergedPRs } from '../services/github';
import { createWebhook } from '../services/webhook';
import { sendMessage } from '../services/telegram';
import { extractRepoOverview } from '../services/gemini';
import { renderRepoDetail, renderError } from '../views';
import { sanitizeError, logInfo, logError } from '../services/security';

export async function addRepoInput(ctx: HandlerContext & { text: string; context: ChatContext }) {
    const { env, chatId, text: input } = ctx;
    await updateChatState(env, chatId, { context: null });

    const parts = input.trim().split('/');
    if (parts.length !== 2) {
        const view = {
            text: `❌ <b>Invalid Format</b>\n\nPlease use the format: <code>owner/repo</code>\n\nExample: <code>ozkeisar/work-content-tracker</code>`,
            keyboard: [[{ text: '🔄 Try again', callback_data: 'action:add_repo' }]],
        };
        const messageId = await sendMessage(env, chatId, view.text, view.keyboard);
        await updateChatState(env, chatId, { message_id: messageId, current_view: 'repos' });
        return;
    }

    const [owner, repo] = parts;

    try {
        const existing = await getRepoByOwnerRepo(env, chatId, owner, repo);
        if (existing) {
            const view = await renderRepoDetail(env, chatId, existing.id);
            const messageId = await sendMessage(
                env,
                chatId,
                `⚠️ <b>Already Watching</b>\n\n<code>${owner}/${repo}</code> is already in your list!\n\n${view.text}`,
                view.keyboard
            );
            await updateChatState(env, chatId, {
                message_id: messageId,
                current_view: 'repo',
                context: { selected_repo_id: existing.id },
            });
            return;
        }

        const isValid = await validateRepo(env, owner, repo);
        if (!isValid) {
            const view = {
                text: `❌ <b>Repository Not Found</b>\n\n<code>${owner}/${repo}</code> does not exist or is not accessible.\n\nMake sure:\n• The repository exists\n• Your GitHub token has access to it`,
                keyboard: [[{ text: '🔄 Try again', callback_data: 'action:add_repo' }]],
            };
            const messageId = await sendMessage(env, chatId, view.text, view.keyboard);
            await updateChatState(env, chatId, { message_id: messageId, current_view: 'repos' });
            return;
        }

        const webhookSecret = crypto.randomUUID();
        const repoId = await createRepo(env, chatId, { owner, repo, webhook_secret: webhookSecret });

        const workerUrl = env.WORKER_URL;
        let webhookStatus = '';
        if (!workerUrl) {
            webhookStatus = '\n\n⚠️ WORKER_URL not configured. Webhook not created.';
        } else {
            const webhookId = await createWebhook(env, owner, repo, workerUrl, webhookSecret);

            if (webhookId) {
                await updateRepo(env, repoId, chatId, { webhook_id: webhookId });
                webhookStatus = '\n\n✅ Webhook created successfully!';
            } else {
                webhookStatus = '\n\n⚠️ Webhook creation failed. Auto-detection may not work.\nCheck that your GITHUB_TOKEN has admin:repo_hook scope.';
            }
        }

        const view = await renderRepoDetail(env, chatId, repoId);
        const messageId = await sendMessage(
            env,
            chatId,
            `✅ <b>Repository Added!</b>\n\n<code>${owner}/${repo}</code> is now being watched.${webhookStatus}\n\n${view.text}`,
            view.keyboard
        );
        await updateChatState(env, chatId, {
            message_id: messageId,
            current_view: 'repo',
            context: { selected_repo_id: repoId },
        });

        // Auto-generate overview in the background (non-blocking)
        try {
            await sendMessage(env, chatId,
                `🔍 Bootstrapping overview for <code>${owner}/${repo}</code>...`
            );
            const [readmeText, prSummaries] = await Promise.all([
                fetchRepoReadme(env, owner, repo),
                fetchRecentMergedPRs(env, owner, repo, 10),
            ]);
            const overview = await extractRepoOverview(env, readmeText, prSummaries);
            await upsertRepoOverview(env, repoId, overview);
            logInfo('Auto-generated overview for repo:', owner + '/' + repo);
            await sendMessage(env, chatId,
                `✅ Overview bootstrapped for <code>${owner}/${repo}</code>!\n\nThis context will improve generated content quality.`,
                [[{ text: '📂 View Repo', callback_data: `repo:${repoId}` }]]
            );
        } catch (overviewError) {
            logError('Auto-overview generation failed:', overviewError instanceof Error ? overviewError.message : String(overviewError));
            await sendMessage(env, chatId,
                `⚠️ Could not auto-generate overview for <code>${owner}/${repo}</code>.\n\nYou can generate it manually with <code>/overview ${owner}/${repo}</code>`,
                [[{ text: '📂 View Repo', callback_data: `repo:${repoId}` }]]
            );
        }
    } catch (error) {
        console.error('Error adding repo:', sanitizeError(error));
        await respond(env, chatId, renderError('Failed to add repository. Please try again.'));
    }
}
