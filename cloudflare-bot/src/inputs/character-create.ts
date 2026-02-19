/**
 * Character creation compose input handler — multi-photo upload and name input
 */

import type { HandlerContext } from '../core/router';
import type { ChatContext, HeyGenCharacter } from '../types';
import { updateChatState, getVideoSettings, updateVideoSettings } from '../services/db';
import { sendMessage, getFileUrl } from '../services/telegram';
import { logInfo, logError } from '../services/security';

interface CharacterCreateInputContext extends HandlerContext {
    text: string;
    context: ChatContext;
    message?: {
        message_id: number;
        photo?: Array<{ file_id: string; file_size?: number }>;
        caption?: string;
    };
}

export async function characterCreateInput(ctx: CharacterCreateInputContext): Promise<void> {
    const { env, chatId, text, context } = ctx;
    const cc = context.characterCreate;

    if (!cc || !cc.active) return;

    if (cc.step === 'awaiting_photos') {
        // Need a photo
        if (!ctx.message?.photo || ctx.message.photo.length === 0) {
            await sendMessage(env, chatId,
                '📷 Please send a <b>photo</b>. Text messages are not accepted at this step.',
                [
                    ...(cc.assetIds.length > 0 ? [[{ text: `✅ Done (${cc.assetIds.length} photo${cc.assetIds.length !== 1 ? 's' : ''})`, callback_data: 'vsettings:done_photos' }]] : []),
                    [{ text: '❌ Cancel', callback_data: 'vsettings:cancel_character' }],
                ],
            );
            return;
        }

        try {
            const largestPhoto = ctx.message.photo[ctx.message.photo.length - 1];
            // Download photo from Telegram
            const fileUrl = await getFileUrl(env, largestPhoto.file_id);
            if (!fileUrl) throw new Error('Could not get file URL from Telegram');
            const response = await fetch(fileUrl);
            if (!response.ok) throw new Error('Failed to download photo from Telegram');

            const imageData = await response.arrayBuffer();

            // Upload to HeyGen
            const { uploadAsset } = await import('../services/heygen');
            const assetId = await uploadAsset(env, imageData, `character_${Date.now()}.jpg`);

            cc.assetIds.push(assetId);
            logInfo('Character photo uploaded to HeyGen, assetId:', assetId, `(${cc.assetIds.length} total)`);

            await updateChatState(env, chatId, {
                context: { ...context, characterCreate: cc },
            });

            const count = cc.assetIds.length;
            const tip = count < 3
                ? '\n\n<i>Tip: Upload 5-10 diverse photos (angles, expressions, outfits) for best results.</i>'
                : count < 5
                    ? '\n\n<i>Good! More photos with different angles and expressions will improve quality.</i>'
                    : '';

            await sendMessage(env, chatId,
                `📷 Photo ${count} uploaded!${tip}\n\nSend more photos or tap <b>Done</b> to continue.`,
                [
                    [{ text: `✅ Done (${count} photo${count !== 1 ? 's' : ''})`, callback_data: 'vsettings:done_photos' }],
                    [{ text: '❌ Cancel', callback_data: 'vsettings:cancel_character' }],
                ],
            );
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            logError('Character photo upload failed:', errMsg);
            await sendMessage(env, chatId,
                `❌ Failed to upload the photo.\n<code>${errMsg}</code>\n\nPlease try again with a different image.`,
                [
                    ...(cc.assetIds.length > 0 ? [[{ text: `✅ Done (${cc.assetIds.length} photos)`, callback_data: 'vsettings:done_photos' }]] : []),
                    [{ text: '❌ Cancel', callback_data: 'vsettings:cancel_character' }],
                ],
            );
        }

    } else if (cc.step === 'awaiting_name') {
        if (!text || text.trim().length === 0) {
            await sendMessage(env, chatId,
                'Please enter a name for the character.',
                [[{ text: '❌ Cancel', callback_data: 'vsettings:cancel_character' }]],
            );
            return;
        }

        const name = text.trim();

        let currentStep = 'init';
        try {
            const { createAvatarGroup, addLooksToGroup, trainAvatarGroup } = await import('../services/heygen');

            await sendMessage(env, chatId,
                `⏳ Creating character "<b>${name}</b>" with ${cc.assetIds.length} photo${cc.assetIds.length !== 1 ? 's' : ''}... This may take a moment.`,
            );

            // Create group with the first photo
            currentStep = 'createAvatarGroup';
            console.log('[char-create] Step 1: createAvatarGroup, assetId:', cc.assetIds[0]);
            const groupId = await createAvatarGroup(env, cc.assetIds[0], name);
            console.log('[char-create] Step 1 done, groupId:', groupId);

            // Add remaining photos as additional looks
            if (cc.assetIds.length > 1) {
                currentStep = 'addLooksToGroup';
                console.log('[char-create] Step 2: addLooksToGroup, count:', cc.assetIds.length - 1);
                await addLooksToGroup(env, groupId, cc.assetIds.slice(1), name);
                console.log('[char-create] Step 2 done');
            }

            // Start avatar training (non-critical — async process)
            let trainingStarted = false;
            try {
                console.log('[char-create] Step 3: trainAvatarGroup');
                await trainAvatarGroup(env, groupId);
                trainingStarted = true;
                console.log('[char-create] Step 3 done, training started');
            } catch (trainErr) {
                console.log('[char-create] Step 3 failed (non-critical):', trainErr instanceof Error ? trainErr.message : String(trainErr));
            }

            // Save character to video settings
            currentStep = 'saveSettings';
            console.log('[char-create] Step 4: saving to video settings');
            const settings = await getVideoSettings(env, chatId);
            const initialLooks = cc.assetIds.map((assetId, i) => ({
                talkingPhotoId: '',
                imageKey: assetId,
                name: `Photo ${i + 1}`,
            }));
            const newCharacter: HeyGenCharacter = {
                heygenGroupId: groupId,
                name,
                defaultEmotion: 'Friendly',
                status: trainingStarted ? 'training' : 'ready',
                looks: initialLooks,
                createdAt: new Date().toISOString(),
            };
            settings.characters.push(newCharacter);
            await updateVideoSettings(env, chatId, settings);
            console.log('[char-create] Step 4 done');

            // Clear compose mode
            await updateChatState(env, chatId, {
                context: { ...context, characterCreate: undefined },
            });

            const lookNote = trainingStarted
                ? `Training started. This typically takes a few minutes. Once complete, talking photos will be available.`
                : `Avatar group created. You can start training from the character detail page.`;

            await sendMessage(env, chatId,
                `✅ <b>Character "${name}" created!</b>\n\n` +
                `Photos uploaded: ${cc.assetIds.length}\n` +
                `${lookNote}`,
                [
                    [{ text: `👁️ View ${name}`, callback_data: `vsettings:char_detail:${groupId}` }],
                    [{ text: '👤 All Characters', callback_data: 'vsettings:characters' }],
                ],
            );
            console.log('[char-create] Success!');
        } catch (error) {
            console.error('[char-create] CATCH block hit:', error instanceof Error ? error.stack || error.message : String(error));
            try {
                await updateChatState(env, chatId, {
                    context: { ...context, characterCreate: undefined },
                });
            } catch (stateErr) {
                console.error('[char-create] Failed to clear state:', stateErr);
            }
            const errMsg = error instanceof Error ? error.message : 'Unknown error';
            // Escape HTML and truncate error message
            const safeMsg = errMsg.replace(/</g, '&lt;').replace(/>/g, '&gt;').substring(0, 300);
            await sendMessage(env, chatId,
                `❌ Character creation failed at <b>${currentStep}</b>:\n<code>${safeMsg}</code>\n\nPlease try again.`,
                [[{ text: '👤 Characters', callback_data: 'vsettings:characters' }]],
            );
        }
    }
}
