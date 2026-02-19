/**
 * Compose mode actions — pen down, toggles, cancel
 */

import type { HandlerContext } from '../core/router';
import type { ViewResult, DraftContent, HandwriteState } from '../types';
import { getChatState, parseContext, updateChatState, createDraft, getTimezone } from '../services/db';
import { sendMessage, editMessage, deleteMessage, sendPhoto } from '../services/telegram';
import { ensureImage } from '../services/storage';
import { renderCompose, renderDraftDetail } from '../views';
import { truncateHtml } from '../views/drafts';
import { renderHome } from '../views/home';
import { sanitizeError } from '../services/security';

export async function composeAction(
    ctx: HandlerContext & { value: string; extra?: string }
): Promise<ViewResult | void> {
    const { env, chatId, value } = ctx;
    const state = await getChatState(env, chatId);
    const context = parseContext(state);
    const handwrite = context.handwrite;

    switch (value) {
        case 'pendown':
            await handlePenDown(env, chatId, handwrite);
            return; // void — handled sending ourselves
        case 'toggle_image':
            return handleToggle(env, chatId, context, handwrite, 'imageGen');
        case 'toggle_ai':
            return handleToggle(env, chatId, context, handwrite, 'aiRefine');
        case 'cancel':
            await handleCancel(env, chatId, ctx.messageId, handwrite);
            return; // void — handled sending ourselves
        default:
            return renderHome(env, chatId);
    }
}

async function handlePenDown(
    env: import('../types').Env,
    chatId: string,
    handwrite: HandwriteState | undefined
): Promise<void> {
    if (!handwrite || handwrite.tweets.length === 0) {
        // No tweets to save — send compose view as new message
        const view = renderCompose([], [], handwrite?.imageGen ?? false, handwrite?.aiRefine ?? false);
        await sendMessage(env, chatId, view.text, view.keyboard);
        return;
    }

    // Send a status message
    const statusText = handwrite.aiRefine && handwrite.imageGen
        ? '✨ Refining text & generating image...'
        : handwrite.aiRefine
            ? '✨ Refining with AI...'
            : handwrite.imageGen
                ? '🖼 Generating image prompt...'
                : '💾 Saving draft...';
    const statusMsgId = await sendMessage(env, chatId, statusText);

    // Build DraftContent from buffer
    const tweets = handwrite.tweets.map((t, i) => ({
        text: t.text,
        index: i,
        mediaKey: t.mediaKey,
        mediaType: t.mediaType,
    }));

    let content: DraftContent = {
        format: tweets.length === 1 ? 'single' : 'thread',
        tweets,
    };

    // If AI refine or image gen is enabled, call Gemini
    if (handwrite.aiRefine || handwrite.imageGen) {
        try {
            const { refineHandwrittenContent } = await import('../services/gemini');
            content = await refineHandwrittenContent(env, content, {
                refineText: handwrite.aiRefine,
                generateImagePrompt: handwrite.imageGen,
            });
            // Preserve media keys from original tweets
            content.tweets = content.tweets.map((t, i) => ({
                ...t,
                mediaKey: handwrite.tweets[i]?.mediaKey,
                mediaType: handwrite.tweets[i]?.mediaType,
            }));
        } catch (error) {
            console.error('AI refinement failed, using original:', error);
            // Continue with original content
        }
    }

    const firstTweet = content.tweets[0]?.text || 'Handwritten draft';
    const prTitle = firstTweet.length > 100 ? firstTweet.substring(0, 97) + '...' : firstTweet;

    let draftId: string;
    try {
        draftId = await createDraft(env, chatId, {
            pr_number: 0,
            pr_title: prTitle,
            commit_sha: '',
            content: JSON.stringify(content),
            source: 'handwrite',
        });
    } catch (dbError) {
        console.error('createDraft failed:', dbError);
        throw dbError;
    }

    // Generate image if imageGen was toggled on
    let imageUrl: string | null = null;
    if (content.imagePrompt) {
        await editMessage(env, chatId, statusMsgId, '🎨 Generating image...');
        try {
            imageUrl = await ensureImage(env, chatId, { id: draftId, content: JSON.stringify(content) });
        } catch (imgError) {
            console.error('Image generation failed:', sanitizeError(imgError));
        }
    }

    const tz = await getTimezone(env, chatId);
    const view = await renderDraftDetail(env, chatId, draftId, tz);

    let finalMessageId: number;

    if (imageUrl) {
        // Delete status message and send photo with draft detail
        try {
            await deleteMessage(env, chatId, statusMsgId);
        } catch { /* ignore */ }
        const fullImageUrl = `${env.WORKER_URL}${imageUrl}`;
        const caption = truncateHtml(view.text, 1024);
        finalMessageId = await sendPhoto(env, chatId, fullImageUrl, caption, view.keyboard);
    } else {
        // No image — edit status message with draft detail
        await editMessage(env, chatId, statusMsgId, view.text, view.keyboard);
        finalMessageId = statusMsgId;
    }

    // Clear compose state and set draft view
    await updateChatState(env, chatId, {
        message_id: finalMessageId,
        current_view: 'draft',
        context: { selected_draft_id: draftId },
    });
}

async function handleToggle(
    env: import('../types').Env,
    chatId: string,
    context: import('../types').ChatContext,
    handwrite: HandwriteState | undefined,
    field: 'imageGen' | 'aiRefine'
): Promise<ViewResult> {
    if (!handwrite) {
        return renderHome(env, chatId);
    }

    handwrite[field] = !handwrite[field];

    await updateChatState(env, chatId, {
        context: {
            ...context,
            handwrite,
        },
    });

    const charWarnings: number[] = [];
    const composeTweets = handwrite.tweets.map((t, i) => {
        if (t.text.length > 280) charWarnings.push(i + 1);
        return { text: t.text, hasMedia: !!t.mediaKey };
    });

    return renderCompose(composeTweets, charWarnings, handwrite.imageGen, handwrite.aiRefine);
}

async function handleCancel(
    env: import('../types').Env,
    chatId: string,
    messageId: number | undefined,
    handwrite: HandwriteState | undefined
): Promise<void> {
    const view = await renderHome(env, chatId);
    const hadTweets = handwrite && handwrite.tweets.length > 0;

    if (hadTweets) {
        // User sent messages — send new message to continue conversation flow
        const newMsgId = await sendMessage(env, chatId, view.text, view.keyboard);
        await updateChatState(env, chatId, {
            message_id: newMsgId,
            current_view: 'home',
            context: null,
        });
    } else {
        // No messages sent — edit the compose message in place
        if (messageId) {
            await editMessage(env, chatId, messageId, view.text, view.keyboard);
        }
        await updateChatState(env, chatId, {
            current_view: 'home',
            context: null,
        });
    }
}
