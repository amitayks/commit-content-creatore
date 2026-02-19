import type { HandlerContext } from '../core/router';
import type { ChatContext } from '../types';
import { updateChatState, createDraft, getTimezone, getRepoByOwnerRepo, applyOverviewPatches } from '../services/db';
import { getContentSource } from '../services/github';
import { generateContent } from '../services/gemini';
import { sendMessage, editMessage, deleteMessage, sendPhoto } from '../services/telegram';
import { ensureImage } from '../services/storage';
import { renderGenerating, renderDraftDetail } from '../views';
import { truncateHtml } from '../views/drafts';
import { sanitizeError } from '../services/security';

export async function commitShaInput(ctx: HandlerContext & { text: string; context: ChatContext }) {
    const { env, chatId, text: sha } = ctx;

    const genView = renderGenerating(sha);
    const genMessageId = await sendMessage(env, chatId, genView.text, genView.keyboard);

    try {
        const source = await getContentSource(env, sha.substring(0, 7));
        const prNumber = source.type === 'pr' ? source.data.number : 0;
        const originalTitle = source.type === 'pr' ? source.data.title : source.data.title;
        const repoShort = source.repo ? source.repo.split('/')[1] || source.repo : '';
        const prTitle = repoShort ? `${repoShort} | ${originalTitle}` : originalTitle;

        // Try to find the watched repo ID for overview context
        let repoId: string | undefined;
        if (source.repo) {
            const [owner, repo] = source.repo.split('/');
            if (owner && repo) {
                const watchedRepo = await getRepoByOwnerRepo(env, chatId, owner, repo);
                if (watchedRepo) repoId = watchedRepo.id;
            }
        }

        const result = await generateContent(env, source, repoId);
        const content = result.content;

        // Apply overview patches (non-blocking)
        if (result.overviewUpdates && repoId) {
            try {
                await applyOverviewPatches(env, repoId, result.overviewUpdates);
            } catch (patchError) {
                console.error('Overview patch failed (non-blocking):', patchError);
            }
        }

        const draftId = await createDraft(env, chatId, {
            pr_number: prNumber,
            pr_title: prTitle,
            commit_sha: sha,
            content: JSON.stringify(content),
        });

        await updateChatState(env, chatId, { context: null });

        // Generate image for the draft
        await editMessage(env, chatId, genMessageId, '🎨 Generating image...');

        let imageUrl: string | null = null;
        try {
            imageUrl = await ensureImage(env, chatId, { id: draftId, content: JSON.stringify(content) });
        } catch (imgError) {
            console.error('Image generation failed:', sanitizeError(imgError));
        }

        const tz = await getTimezone(env, chatId);
        const view = await renderDraftDetail(env, chatId, draftId, tz);

        let finalMessageId: number;

        if (imageUrl) {
            // Delete the text "Generating..." message and send photo with draft detail
            try {
                await deleteMessage(env, chatId, genMessageId);
            } catch { /* ignore */ }
            const fullImageUrl = `${env.WORKER_URL}${imageUrl}`;
            const caption = truncateHtml(view.text, 1024);
            finalMessageId = await sendPhoto(env, chatId, fullImageUrl, caption, view.keyboard);
        } else {
            // No image — edit the "Generating..." message with draft detail
            await editMessage(env, chatId, genMessageId, view.text, view.keyboard);
            finalMessageId = genMessageId;
        }

        await updateChatState(env, chatId, {
            message_id: finalMessageId,
            current_view: 'draft',
            context: { selected_draft_id: draftId },
        });
    } catch (error) {
        console.error('Generate error:', sanitizeError(error));
        // Keep awaiting_input so user can retry with a different SHA
        await sendMessage(env, chatId,
            `❌ <b>Generation failed</b>\n\nCouldn't generate content for <code>${sha.substring(0, 7)}</code>.\n\nSend another commit SHA or PR number to try again.`,
            [[{ text: '❌ Cancel', callback_data: 'view:home' }]]
        );
    }
}
