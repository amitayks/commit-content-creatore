/**
 * Look creation compose input handler — photo upload for new looks
 */

import type { HandlerContext } from '../core/router';
import type { ChatContext } from '../types';
import { updateChatState, getVideoSettings, updateVideoSettings } from '../services/db';
import { sendMessage, getFileUrl } from '../services/telegram';
import { logInfo, logError } from '../services/security';

interface LookCreateInputContext extends HandlerContext {
    text: string;
    context: ChatContext;
    message?: {
        message_id: number;
        photo?: Array<{ file_id: string; file_size?: number }>;
    };
}

export async function lookCreateInput(ctx: LookCreateInputContext): Promise<void> {
    const { env, chatId, text, context } = ctx;
    const lc = context.lookCreate;

    if (!lc || !lc.active) return;

    if (lc.step === 'awaiting_photo') {
        // Need a photo, not text
        if (!ctx.message?.photo || ctx.message.photo.length === 0) {
            await sendMessage(env, chatId,
                '📷 Please send a <b>photo</b> to add as a look. Text messages are not accepted.',
                [[{ text: '❌ Cancel', callback_data: `vsettings:char_detail:${lc.characterGroupId}` }]],
            );
            return;
        }

        try {
            const largestPhoto = ctx.message.photo[ctx.message.photo.length - 1];
            const fileUrl = await getFileUrl(env, largestPhoto.file_id);
            if (!fileUrl) throw new Error('Could not get file URL from Telegram');
            const response = await fetch(fileUrl);
            if (!response.ok) throw new Error('Failed to download photo from Telegram');

            const imageData = await response.arrayBuffer();

            const { uploadAsset } = await import('../services/heygen');

            await sendMessage(env, chatId, '⏳ Uploading photo to HeyGen...');

            const imageKey = await uploadAsset(env, imageData, `look_${Date.now()}.jpg`);
            logInfo('Look photo uploaded, imageKey:', imageKey);

            // Transition to awaiting_name — store imageKey, defer addLooksToGroup until name is provided
            await updateChatState(env, chatId, {
                context: {
                    ...context,
                    lookCreate: { ...lc, step: 'awaiting_name', imageKey },
                },
            });

            await sendMessage(env, chatId,
                '✅ Photo uploaded! Now send a <b>name</b> for this look (e.g. "Casual", "Professional", "Outdoor").',
                [[{ text: '❌ Cancel', callback_data: `vsettings:char_detail:${lc.characterGroupId}` }]],
            );
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            logError('Look upload failed:', errMsg);
            await updateChatState(env, chatId, {
                context: { ...context, lookCreate: undefined },
            });
            const safeMsg = errMsg.replace(/</g, '&lt;').replace(/>/g, '&gt;').substring(0, 200);
            await sendMessage(env, chatId,
                `❌ Look upload failed:\n<code>${safeMsg}</code>`,
                [[{ text: '◀️ Back', callback_data: `vsettings:char_detail:${lc.characterGroupId}` }]],
            );
        }
    } else if (lc.step === 'awaiting_name') {
        const lookName = text.trim();
        if (!lookName) {
            await sendMessage(env, chatId,
                'Please send a name for this look.',
                [[{ text: '❌ Cancel', callback_data: `vsettings:char_detail:${lc.characterGroupId}` }]],
            );
            return;
        }

        try {
            // Add to avatar group with the user's name
            const { addLooksToGroup } = await import('../services/heygen');
            await addLooksToGroup(env, lc.characterGroupId, [lc.imageKey!], lookName);
            logInfo('Look added to group:', lc.characterGroupId, 'name:', lookName);

            // Store look on character with the user-provided name
            const settings = await getVideoSettings(env, chatId);
            const char = settings.characters.find(c => c.heygenGroupId === lc.characterGroupId);
            if (char) {
                char.looks.push({
                    talkingPhotoId: '',
                    imageKey: lc.imageKey || '',
                    name: lookName,
                });
                await updateVideoSettings(env, chatId, settings);
            }

            // Clear compose mode
            await updateChatState(env, chatId, {
                context: { ...context, lookCreate: undefined },
            });

            await sendMessage(env, chatId,
                `✅ <b>Look "${lookName}" added!</b>\n\nUse "Sync Looks" after training to link the talking photo ID.`,
                [
                    [{ text: '🔄 Sync Looks', callback_data: `vsettings:sync_looks:${lc.characterGroupId}` }],
                    [{ text: '◀️ Back', callback_data: `vsettings:char_detail:${lc.characterGroupId}` }],
                ],
            );
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            logError('Look add-to-group failed:', errMsg);
            await updateChatState(env, chatId, {
                context: { ...context, lookCreate: undefined },
            });
            const safeMsg = errMsg.replace(/</g, '&lt;').replace(/>/g, '&gt;').substring(0, 200);
            await sendMessage(env, chatId,
                `❌ Failed to add look to group:\n<code>${safeMsg}</code>`,
                [[{ text: '◀️ Back', callback_data: `vsettings:char_detail:${lc.characterGroupId}` }]],
            );
        }
    }
}
