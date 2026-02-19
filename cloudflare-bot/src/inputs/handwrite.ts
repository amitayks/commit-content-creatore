/**
 * Handwrite input handler — buffers user messages as tweets during compose mode
 */

import type { HandlerContext } from '../core/router';
import type { ChatContext, HandwriteState, HandwriteTweet } from '../types';
import { updateChatState, getChatState, parseContext } from '../services/db';
import { editMessage } from '../services/telegram';
import { storeUserMedia } from '../services/storage';
import { renderCompose } from '../views';

interface HandwriteInputContext extends HandlerContext {
    text: string;
    context: ChatContext;
    message?: {
        message_id: number;
        photo?: Array<{ file_id: string; file_size?: number }>;
        caption?: string;
    };
    isEdit?: boolean;
}

export async function handwriteInput(ctx: HandwriteInputContext): Promise<void> {
    const { env, chatId, context } = ctx;
    const handwrite = context.handwrite;

    if (!handwrite) {
        // No handwrite state, clear and go home
        await updateChatState(env, chatId, { context: null });
        return;
    }

    const messageId = ctx.message?.message_id || 0;

    if (ctx.isEdit) {
        // Edit existing tweet in buffer
        const tweetIndex = handwrite.tweets.findIndex(t => t.messageId === messageId);
        if (tweetIndex >= 0) {
            handwrite.tweets[tweetIndex].text = ctx.text;
        }
        // If not found, ignore (edit for message we don't track)
    } else {
        // New message — buffer as a new tweet
        const tweet: HandwriteTweet = {
            messageId,
            text: ctx.text,
        };

        // Handle photo attachment
        if (ctx.message?.photo && ctx.message.photo.length > 0) {
            // Use the largest photo (last in array)
            const largestPhoto = ctx.message.photo[ctx.message.photo.length - 1];
            const mediaKey = await storeUserMedia(env, chatId, messageId, largestPhoto.file_id);
            if (mediaKey) {
                tweet.mediaKey = mediaKey;
                tweet.mediaType = 'photo';
            }
            // Use caption as text if available
            if (ctx.message.caption) {
                tweet.text = ctx.message.caption;
            }
        }

        handwrite.tweets.push(tweet);
    }

    // Build tweet previews and character warnings
    const charWarnings: number[] = [];
    const composeTweets = handwrite.tweets.map((t, i) => {
        if (t.text.length > 280) charWarnings.push(i + 1);
        return { text: t.text, hasMedia: !!t.mediaKey };
    });

    // Update state
    await updateChatState(env, chatId, {
        context: {
            ...context,
            handwrite,
        },
    });

    // Update the status message with live preview
    const state = await getChatState(env, chatId);
    const statusMessageId = handwrite.statusMessageId || state.message_id;

    if (statusMessageId) {
        const view = renderCompose(composeTweets, charWarnings, handwrite.imageGen, handwrite.aiRefine);
        try {
            await editMessage(env, chatId, statusMessageId, view.text, view.keyboard);
        } catch {
            // Status message may have been deleted, ignore
        }
    }
}
