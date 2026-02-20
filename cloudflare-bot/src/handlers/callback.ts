/**
 * Callback Handler - Process button clicks
 *
 * Routes callbacks through dispatch tables.
 * Handles photo-to-text message transition.
 * SECURITY: All operations verify ownership via chatId
 */

import type { Env, TelegramCallbackQuery } from '../types';
import { editMessage, editMessageCaption, answerCallback, sendMessage, deleteMessage } from '../services/telegram';
import { sanitizeError } from '../services/security';
import { callbackHandlers } from '../core/router';
import { renderError } from '../views';
import { truncateHtml } from '../views/drafts';

/**
 * Handle callback query (button click)
 */
export async function handleCallback(
    env: Env,
    callback: TelegramCallbackQuery,
    executionCtx?: ExecutionContext
): Promise<void> {
    if (!callback.message || !callback.data) {
        await answerCallback(env, callback.id);
        return;
    }

    const chatId = String(callback.message.chat.id);
    const messageId = callback.message.message_id;
    const data = callback.data;

    console.log('Processing callback:', chatId, data);

    // Answer callback immediately to remove "loading" state
    answerCallback(env, callback.id).catch(() => {});

    try {
        // Parse callback data: prefix:value or prefix:value:extra
        // Extra may contain colons (e.g., config:timezone:UTC+5:30)
        const parts = data.split(':');
        const prefix = parts[0];
        const value = parts[1] || '';
        const extra = parts.slice(2).join(':') || undefined;

        const handler = callbackHandlers[prefix];
        let view;

        if (handler) {
            view = await handler({ env, chatId, messageId, value, extra, executionCtx });
        }

        // If handler returned void, it handled its own response (e.g., photo send)
        if (!view) return;

        // Photo messages: preserve image for action callbacks, transition to text for navigation
        const isPhotoMessage = 'photo' in callback.message;

        // Truncate text to Telegram's limits
        const safeText = truncateHtml(view.text, 4096);

        const linkOpts = view.disableLinkPreview ? { disableLinkPreview: true } : undefined;

        if (isPhotoMessage && prefix === 'action') {
            // Action on a draft with image — update caption in place to keep the photo
            const caption = truncateHtml(safeText, 1024);
            await editMessageCaption(env, chatId, messageId, caption, view.keyboard);
        } else if (isPhotoMessage) {
            // Navigating away from draft — transition to text message
            try {
                await deleteMessage(env, chatId, messageId);
            } catch { /* ignore */ }
            await sendMessage(env, chatId, safeText, view.keyboard, linkOpts);
        } else {
            await editMessage(env, chatId, messageId, safeText, view.keyboard, linkOpts);
        }
    } catch (error) {
        const errDetail = error instanceof Error ? (error.stack || error.message) : String(error);
        console.error('Callback handler error:', errDetail);
        const safeDetail = (error instanceof Error ? error.message : String(error))
            .replace(/</g, '&lt;').replace(/>/g, '&gt;').substring(0, 300);
        const view = renderError(`An error occurred.\n<code>${safeDetail}</code>`);
        try {
            await editMessage(env, chatId, messageId, view.text, view.keyboard);
        } catch {
            try {
                await sendMessage(env, chatId, view.text, view.keyboard);
            } catch { /* last resort */ }
        }
    }
}
