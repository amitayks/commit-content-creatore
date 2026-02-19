/**
 * Message Handler - Process incoming text messages
 *
 * Routes commands and input through dispatch tables.
 * SECURITY: All operations verify ownership via chatId
 */

import type { Env, TelegramMessage } from '../types';
import { getChatState, parseContext, updateChatState } from '../services/db';
import { sanitizeError } from '../services/security';
import { sendMessage } from '../services/telegram';
import { respond } from '../core/respond';
import { commandHandlers, inputHandlers } from '../core/router';
import { renderHome, renderError } from '../views';
import { characterCreateInput } from '../inputs/character-create';
import { lookCreateInput } from '../inputs/look-create';
import { videoComposeInput } from '../inputs/video-compose';

/**
 * Handle incoming text message (or edited message)
 */
export async function handleMessage(env: Env, message: TelegramMessage, isEdit = false): Promise<void> {
    const chatId = String(message.chat.id);
    const text = message.text?.trim() || message.caption?.trim() || '';

    console.log('Processing message:', chatId, isEdit ? '(edit)' : '', text.substring(0, 50));

    try {
        // Get current state
        const state = await getChatState(env, chatId);
        const context = parseContext(state);

        // ==================== COMPOSE MODE PRIORITY ====================
        // Priority: characterCreate → lookCreate → videoCompose → handwrite → regular

        // Character creation compose mode
        if (context.characterCreate?.active) {
            // Cancel on slash command
            if (!isEdit && text.startsWith('/')) {
                await updateChatState(env, chatId, {
                    context: { ...context, characterCreate: undefined },
                });
                await sendMessage(env, chatId, 'Character creation cancelled.', []);
                // Fall through to handle the command
            } else {
                await characterCreateInput({
                    env, chatId, text, context,
                    message: {
                        message_id: message.message_id,
                        photo: message.photo,
                        caption: message.caption,
                    },
                } as any);
                return;
            }
        }

        // Look creation compose mode
        if (context.lookCreate?.active) {
            if (!isEdit && text.startsWith('/')) {
                await updateChatState(env, chatId, {
                    context: { ...context, lookCreate: undefined },
                });
                await sendMessage(env, chatId, 'Look creation cancelled.', []);
            } else {
                await lookCreateInput({
                    env, chatId, text, context,
                    message: {
                        message_id: message.message_id,
                        photo: message.photo,
                    },
                } as any);
                return;
            }
        }

        // Video compose mode (manual instructions)
        if (context.videoCompose?.active) {
            if (!isEdit && text.startsWith('/')) {
                await updateChatState(env, chatId, {
                    context: { ...context, videoCompose: { ...context.videoCompose, active: false } },
                });
                await sendMessage(env, chatId, 'Video instructions compose cancelled.', []);
            } else {
                await videoComposeInput({
                    env, chatId, text, context,
                    message: {
                        message_id: message.message_id,
                        photo: message.photo,
                        caption: message.caption,
                    },
                } as any);
                return;
            }
        }

        // Handle handwrite compose mode specially
        if (context.awaiting_input === 'handwrite') {
            // Check if this is a recognized slash command — cancel compose and run command
            if (!isEdit && text.startsWith('/')) {
                const parts = text.split(' ');
                const command = parts[0].toLowerCase();

                if (commandHandlers[command]) {
                    // Cancel compose session
                    await updateChatState(env, chatId, { current_view: 'home', context: null });

                    // Execute the command
                    const args = parts.slice(1).join(' ');
                    const view = await commandHandlers[command]({ env, chatId, args });
                    if (view) {
                        await sendMessage(env, chatId, view.text, view.keyboard);
                    }
                    return;
                }
                // Unrecognized command — treat as tweet text, fall through to input handler
            }

            // Route to handwrite input handler
            const handler = inputHandlers['handwrite'];
            if (handler) {
                await handler({
                    env,
                    chatId,
                    text,
                    context,
                    message: {
                        message_id: message.message_id,
                        photo: message.photo,
                        caption: message.caption,
                    },
                    isEdit,
                } as any);
                return;
            }
        }

        // If this is an edit and we're not in compose mode, ignore it
        if (isEdit) {
            return;
        }

        // Check if we're awaiting other input types
        if (context.awaiting_input) {
            const handler = inputHandlers[context.awaiting_input];
            if (handler) {
                const view = await handler({ env, chatId, text, context, messageId: message.message_id });
                if (view) {
                    await respond(env, chatId, view, { viewName: state?.current_view || 'home', context: null });
                }
                return;
            }
            // Unknown input state, fall through to home
        }

        // Parse command
        if (text.startsWith('/')) {
            const parts = text.split(' ');
            const command = parts[0].toLowerCase();
            const args = parts.slice(1).join(' ');

            const handler = commandHandlers[command];
            if (handler) {
                const view = await handler({ env, chatId, args });
                if (view) {
                    await sendMessage(env, chatId, view.text, view.keyboard);
                }
                return;
            }
            // Unknown command, fall through to home
        }

        // Default: show home (only for non-empty text messages)
        if (text) {
            await respond(env, chatId, await renderHome(env, chatId), { viewName: 'home', context: null });
        }
    } catch (error) {
        const errDetail = error instanceof Error ? (error.stack || error.message) : String(error);
        console.error('Message handler error:', errDetail);
        const safeDetail = (error instanceof Error ? error.message : String(error)).replace(/</g, '&lt;').replace(/>/g, '&gt;').substring(0, 200);
        const view = renderError(`An error occurred.\n<code>${safeDetail}</code>`);
        await sendMessage(env, chatId, view.text, view.keyboard).catch(() => {});
    }
}
