/**
 * Video Actions — configuration toggles, create/approve/publish/schedule/delete flows
 */

import type { HandlerContext } from '../core/router';
import type { ViewResult, VideoConfig, VideoScriptResponse, ChatContext } from '../types';
import { DEFAULT_VIDEO_CONFIG } from '../types';
import {
    createVideoDraft, getVideoDraft, updateVideoDraft, deleteVideoDraft,
    getRepoOverview, updateChatState, parseContext, getChatState,
} from '../services/db';
import { generateVideoScript } from '../services/gemini';
import { createVideo as heygenCreateVideo } from '../services/heygen';
import { renderVideoConfig, renderScriptPreview, renderVideoDetail, renderVideoRepoHome } from '../views';
import { sendMessage, editMessage } from '../services/telegram';
import { logInfo, logError } from '../services/security';

// Option arrays for cycling toggles
const TONE_OPTIONS = ['Casual Update', 'Professional Announcement', 'Technical Deep Dive', 'Excited Launch', 'Community Chat'];
const LENGTH_OPTIONS = ['30s', '60s', '90s', '2m', '3m', '5m'];
const ASPECT_OPTIONS: Array<'9:16' | '16:9' | '1:1'> = ['9:16', '16:9', '1:1'];
const EMOTION_OPTIONS = ['Excited', 'Friendly', 'Serious', 'Soothing', 'Broadcaster'];
const DEPTH_OPTIONS = [
    { value: '0' },
    { value: '1' },
    { value: '3' },
    { value: '5' },
    { value: 'since_last_video' },
];

// ==================== CONFIG FIELD TOGGLES (8.1) ====================

export async function videoConfigAction(ctx: HandlerContext & { value: string; extra?: string }): Promise<ViewResult | void> {
    const { env, chatId, value: field, extra } = ctx;
    const state = await getChatState(env, chatId);
    const context = parseContext(state);
    const config: VideoConfig = context.video_config || { ...DEFAULT_VIDEO_CONFIG };
    const repoId = extra || context.selected_repo_id || 'standalone';

    switch (field) {
        // Cycling toggles — each tap advances to the next option
        case 'tone': {
            const idx = TONE_OPTIONS.indexOf(config.tone);
            config.tone = TONE_OPTIONS[(idx + 1) % TONE_OPTIONS.length];
            await updateChatState(env, chatId, { context: { ...context, video_config: config, selected_repo_id: repoId } });
            return renderVideoConfig(repoId, config);
        }
        case 'length': {
            const idx = LENGTH_OPTIONS.indexOf(config.length);
            config.length = LENGTH_OPTIONS[(idx + 1) % LENGTH_OPTIONS.length];
            await updateChatState(env, chatId, { context: { ...context, video_config: config, selected_repo_id: repoId } });
            return renderVideoConfig(repoId, config);
        }
        case 'aspect': {
            const idx = ASPECT_OPTIONS.indexOf(config.aspectRatio);
            config.aspectRatio = ASPECT_OPTIONS[(idx + 1) % ASPECT_OPTIONS.length];
            await updateChatState(env, chatId, { context: { ...context, video_config: config, selected_repo_id: repoId } });
            return renderVideoConfig(repoId, config);
        }
        case 'emotion': {
            const idx = EMOTION_OPTIONS.indexOf(config.emotion);
            config.emotion = EMOTION_OPTIONS[(idx + 1) % EMOTION_OPTIONS.length] as any;
            await updateChatState(env, chatId, { context: { ...context, video_config: config, selected_repo_id: repoId } });
            return renderVideoConfig(repoId, config);
        }
        case 'depth': {
            const currentVal = String(config.commitDepth);
            const idx = DEPTH_OPTIONS.findIndex(d => d.value === currentVal);
            const next = DEPTH_OPTIONS[(idx + 1) % DEPTH_OPTIONS.length];
            config.commitDepth = next.value === 'since_last_video' ? next.value : parseInt(next.value, 10) || 0;
            await updateChatState(env, chatId, { context: { ...context, video_config: config, selected_repo_id: repoId } });
            return renderVideoConfig(repoId, config);
        }
        case 'captions': {
            config.captions = !config.captions;
            await updateChatState(env, chatId, { context: { ...context, video_config: config, selected_repo_id: repoId } });
            return renderVideoConfig(repoId, config);
        }
        case 'overlay': {
            config.textOverlay = !config.textOverlay;
            await updateChatState(env, chatId, { context: { ...context, video_config: config, selected_repo_id: repoId } });
            return renderVideoConfig(repoId, config);
        }

        // Character selector — pick character then look
        case 'character': {
            const { getVideoSettings } = await import('../services/db');
            const videoSettings = await getVideoSettings(env, chatId);
            const chars = videoSettings.characters;

            if (chars.length === 0) {
                return {
                    text: '👤 <b>Select Character</b>\n\nNo characters configured yet.\nAdd a character in Video Settings first.',
                    keyboard: [
                        [{ text: '⚙️ Video Settings', callback_data: 'vsettings:characters' }],
                        [{ text: '◀️ Back', callback_data: `action:video_create:${repoId}` }],
                    ],
                };
            }

            const keyboard: import('../types').InlineButton[][] = [];
            for (let i = 0; i < chars.length; i++) {
                const c = chars[i];
                const isSelected = config.characterId === c.heygenGroupId;
                const status = c.status === 'ready' ? '✅' : c.status === 'training' ? '⏳' : '❌';
                keyboard.push([{
                    text: `${isSelected ? '● ' : ''}${status} ${c.name}`,
                    callback_data: `vconfig:pc:${i}`,
                }]);
            }
            keyboard.push([{ text: '◀️ Back', callback_data: `action:video_create:${repoId}` }]);

            return {
                text: '👤 <b>Select Character</b>\n\nChoose a character for the video:',
                keyboard,
            };
        }

        // Pick character → show looks
        case 'pc': {
            const charIndex = parseInt(extra || '0', 10);
            const selectedRepoId = context.selected_repo_id || 'standalone';
            const { getVideoSettings } = await import('../services/db');
            const videoSettings = await getVideoSettings(env, chatId);
            const chars = videoSettings.characters;
            const char = chars[charIndex];

            if (!char) return renderVideoConfig(selectedRepoId, config);

            const looks = char.looks || [];
            if (looks.length === 0) {
                return {
                    text: `👤 <b>${char.name}</b>\n\nNo looks available.\nTrain the avatar and sync looks first.`,
                    keyboard: [
                        [{ text: '⚙️ Character Settings', callback_data: `vsettings:char_detail:${char.heygenGroupId}` }],
                        [{ text: '◀️ Back', callback_data: `vconfig:character:${selectedRepoId}` }],
                    ],
                };
            }

            if (!char.voiceId) {
                return {
                    text: `👤 <b>${char.name}</b>\n\n⚠️ No voice configured for this character.\nSet a voice in character settings first.`,
                    keyboard: [
                        [{ text: '⚙️ Character Settings', callback_data: `vsettings:char_detail:${char.heygenGroupId}` }],
                        [{ text: '◀️ Back', callback_data: `vconfig:character:${selectedRepoId}` }],
                    ],
                };
            }

            const keyboard: import('../types').InlineButton[][] = [];
            for (let i = 0; i < Math.min(looks.length, 10); i++) {
                const l = looks[i];
                const isSelected = config.talkingPhotoId === l.talkingPhotoId;
                const name = l.name.length > 30 ? l.name.substring(0, 28) + '..' : l.name;
                keyboard.push([{
                    text: `${isSelected ? '✅ ' : ''}${name}`,
                    callback_data: `vconfig:pl:${charIndex}:${i}`,
                }]);
            }
            keyboard.push([{ text: '◀️ Back', callback_data: `vconfig:character:${selectedRepoId}` }]);

            return {
                text: `🎭 <b>Select Look for ${char.name}</b>\n\nChoose which appearance to use:`,
                keyboard,
            };
        }

        // Pick look → populate config and return to config screen
        case 'pl': {
            const parts = (extra || '').split(':');
            const charIndex = parseInt(parts[0] || '0', 10);
            const lookIndex = parseInt(parts[1] || '0', 10);
            const selectedRepoId = context.selected_repo_id || 'standalone';

            const { getVideoSettings } = await import('../services/db');
            const videoSettings = await getVideoSettings(env, chatId);
            const chars = videoSettings.characters;
            const char = chars[charIndex];

            if (!char) return renderVideoConfig(selectedRepoId, config);

            const look = (char.looks || [])[lookIndex];
            if (!look) return renderVideoConfig(selectedRepoId, config);

            // Populate config with character data
            config.characterId = char.heygenGroupId;
            config.talkingPhotoId = look.talkingPhotoId;
            config.imageKey = look.imageKey;
            config.voiceId = char.voiceId;

            await updateChatState(env, chatId, {
                context: { ...context, video_config: config, selected_repo_id: selectedRepoId },
            });

            return renderVideoConfig(selectedRepoId, config, char.name);
        }

        // Manual instructions (8.2)
        case 'instructions': {
            await updateChatState(env, chatId, {
                current_view: 'video_instructions',
                context: {
                    ...context,
                    video_config: config,
                    selected_repo_id: repoId,
                    videoCompose: { active: true, repoId, instructions: [], config },
                },
            });
            const hasExisting = !!config.manualInstructions;
            return {
                text: `📝 <b>Manual Instructions</b>\n\n${hasExisting ? `Current:\n<i>${config.manualInstructions!.substring(0, 200)}</i>\n\n` : ''}Type your instructions for the video script.\nThis will guide the AI on what to emphasize, exclude, or focus on.`,
                keyboard: [
                    [{ text: '💾 Save', callback_data: `vconfig:save_instructions:${repoId}` }],
                    ...(hasExisting ? [[{ text: '🗑 Clear', callback_data: `vconfig:clear_instructions:${repoId}` }]] : []),
                    [{ text: '❌ Cancel', callback_data: `action:video_create:${repoId}` }],
                ],
            };
        }
        case 'save_instructions': {
            const compose = context.videoCompose;
            if (compose && compose.instructions.length > 0) {
                // Instructions were added — save and send a NEW message
                const existing = config.manualInstructions ? config.manualInstructions + '\n' : '';
                config.manualInstructions = existing + compose.instructions.join('\n');
                await updateChatState(env, chatId, {
                    context: { ...context, video_config: config, selected_repo_id: repoId, videoCompose: undefined },
                });
                const view = renderVideoConfig(repoId, config);
                await sendMessage(env, chatId, `✅ Instructions saved.\n\n${view.text}`, view.keyboard);
                return; // void — we sent our own message
            }
            // Nothing was added — just edit existing message back to config
            await updateChatState(env, chatId, {
                context: { ...context, video_config: config, selected_repo_id: repoId, videoCompose: undefined },
            });
            return renderVideoConfig(repoId, config);
        }
        case 'clear_instructions': {
            config.manualInstructions = undefined;
            await updateChatState(env, chatId, {
                context: { ...context, video_config: config, selected_repo_id: repoId, videoCompose: undefined },
            });
            return renderVideoConfig(repoId, config);
        }

        // Preset save/load
        case 'save_preset': {
            await updateChatState(env, chatId, {
                context: { ...context, video_config: config, selected_repo_id: repoId, awaiting_input: 'video_preset_name' },
            });
            return {
                text: '💾 <b>Save Preset</b>\n\nType a name for this preset:',
                keyboard: [[{ text: '❌ Cancel', callback_data: `action:video_create:${repoId}` }]],
            };
        }
        case 'load_preset': {
            const { getVideoPresets } = await import('../services/db');
            const presets = await getVideoPresets(env, chatId);
            if (presets.length === 0) {
                return {
                    text: 'No presets saved yet. Use "Save Preset" to create one.',
                    keyboard: [[{ text: '◀️ Back', callback_data: `action:video_create:${repoId}` }]],
                };
            }
            // Use numeric index instead of preset UUID to stay under 64-byte limit
            return {
                text: '📂 <b>Load Preset</b>',
                keyboard: [
                    ...presets.map((p, i) => [{ text: p.name, callback_data: `vconfig:ap:${repoId}:${i}` }]),
                    [{ text: '◀️ Back', callback_data: `action:video_create:${repoId}` }],
                ],
            };
        }
        case 'ap': {
            const colonIdx = (extra || '').indexOf(':');
            if (colonIdx > -1) {
                const idx = parseInt((extra || '').substring(colonIdx + 1), 10);
                const { getVideoPresets } = await import('../services/db');
                const presets = await getVideoPresets(env, chatId);
                const preset = presets[idx];
                if (preset) {
                    const raw = JSON.parse(preset.config);
                    // Pick only known VideoConfig fields, ignoring legacy engine/avatarStyle
                    const loaded: VideoConfig = {
                        ...DEFAULT_VIDEO_CONFIG,
                        ...(raw.commitDepth !== undefined && { commitDepth: raw.commitDepth }),
                        ...(raw.tone && { tone: raw.tone }),
                        ...(raw.length && { length: raw.length }),
                        ...(raw.characterId && { characterId: raw.characterId }),
                        ...(raw.lookId && { lookId: raw.lookId }),
                        ...(raw.talkingPhotoId && { talkingPhotoId: raw.talkingPhotoId }),
                        ...(raw.imageKey && { imageKey: raw.imageKey }),
                        ...(raw.voiceId && { voiceId: raw.voiceId }),
                        ...(raw.aspectRatio && { aspectRatio: raw.aspectRatio }),
                        ...(raw.emotion && { emotion: raw.emotion }),
                        ...(raw.background && { background: raw.background }),
                        ...(raw.captions !== undefined && { captions: raw.captions }),
                        ...(raw.textOverlay !== undefined && { textOverlay: raw.textOverlay }),
                        ...(raw.manualInstructions && { manualInstructions: raw.manualInstructions }),
                    };
                    await updateChatState(env, chatId, { context: { ...context, video_config: loaded, selected_repo_id: repoId } });
                    return renderVideoConfig(repoId, loaded);
                }
            }
            return renderVideoConfig(repoId, config);
        }

        default:
            return renderVideoConfig(repoId, config);
    }
}

// ==================== CREATE VIDEO (8.3) ====================

export async function videoCreateAction(ctx: HandlerContext & { value: string; extra?: string }): Promise<ViewResult | void> {
    const { env, chatId, extra: repoId } = ctx;
    const state = await getChatState(env, chatId);
    const context = parseContext(state);
    const config: VideoConfig = context.video_config || { ...DEFAULT_VIDEO_CONFIG };

    // Show config screen
    await updateChatState(env, chatId, {
        context: { ...context, video_config: config, selected_repo_id: repoId || 'standalone' },
    });
    return renderVideoConfig(repoId || 'standalone', config);
}

// ==================== GENERATE SCRIPT (8.3) ====================

export async function videoGenerateAction(ctx: HandlerContext & { value: string; extra?: string }): Promise<ViewResult | void> {
    const { env, chatId, extra: repoId } = ctx;
    const state = await getChatState(env, chatId);
    const context = parseContext(state);
    const config: VideoConfig = context.video_config || { ...DEFAULT_VIDEO_CONFIG };

    // Show loading state immediately so user knows something is happening
    if (ctx.messageId) {
        await editMessage(env, chatId, ctx.messageId,
            '⏳ <b>Generating Script...</b>\n\n' +
            '🤖 AI is writing your video script.\n' +
            'This usually takes 5-15 seconds.',
            [[{ text: '❌ Cancel', callback_data: repoId === 'standalone' ? 'view:video_studio' : `view:video_repo:${repoId}` }]],
        ).catch(() => {}); // ignore edit failure
    }

    try {
        // Fetch overview for context
        const overview = repoId && repoId !== 'standalone'
            ? await getRepoOverview(env, repoId, chatId)
            : null;

        // Generate script via Gemini
        const script = await generateVideoScript(env, {
            overview,
            tone: config.tone,
            length: config.length,
            manualInstructions: config.manualInstructions,
            emotion: config.emotion,
            textOverlayEnabled: config.textOverlay,
        });

        // Create video draft
        const draftId = await createVideoDraft(env, chatId, {
            repo_id: repoId !== 'standalone' ? repoId : undefined,
            script: JSON.stringify(script),
            caption: script.caption,
            twitter_caption: script.twitterCaption,
            title: script.title,
            config: JSON.stringify(config),
        });

        const draft = await getVideoDraft(env, draftId, chatId);
        if (!draft) throw new Error('Failed to retrieve created draft');

        return renderScriptPreview(draft, script, config);
    } catch (error) {
        logError('Video script generation failed:', error instanceof Error ? error.message : String(error));
        return {
            text: `❌ <b>Script Generation Failed</b>\n\n${error instanceof Error ? error.message : 'Unknown error'}`,
            keyboard: [
                [{ text: '🔄 Retry', callback_data: `action:video_generate:${repoId}` }],
                [{ text: '◀️ Back', callback_data: repoId === 'standalone' ? 'view:video_studio' : `view:video_repo:${repoId}` }],
            ],
        };
    }
}

// ==================== APPROVE & GENERATE (8.4) ====================

export async function videoApproveAction(ctx: HandlerContext & { value: string; extra?: string }): Promise<ViewResult | void> {
    const { env, chatId, extra: draftId } = ctx;
    if (!draftId) return;

    const draft = await getVideoDraft(env, draftId, chatId);
    if (!draft) return { text: '❌ Video draft not found.', keyboard: [[{ text: '🏠 Home', callback_data: 'view:home' }]] };

    const config = JSON.parse(draft.config || '{}') as VideoConfig;
    const script = JSON.parse(draft.script || '{}') as VideoScriptResponse;

    if (!config.voiceId) {
        return {
            text: '❌ <b>Missing Voice</b>\n\nPlease set a voice for your character before generating.\n\nGo to Video Settings → Character → Voice.',
            keyboard: [
                [{ text: '⚙️ Video Settings', callback_data: 'view:video_settings' }],
                [{ text: '◀️ Back', callback_data: `view:video_detail:${draftId}` }],
            ],
        };
    }

    if (!config.imageKey) {
        return {
            text: '❌ <b>Missing Image Key</b>\n\nThis look doesn\'t have an image key. Please re-upload the photo for this look, or select a different look.\n\nGo to Video Settings → Character → Add Look to upload a photo.',
            keyboard: [
                [{ text: '⚙️ Video Settings', callback_data: 'view:video_settings' }],
                [{ text: '◀️ Back', callback_data: `view:video_detail:${draftId}` }],
            ],
        };
    }

    try {
        const callbackUrl = `${ctx.env.WORKER_URL}/heygen-webhook`;
        const heygenVideoId = await heygenCreateVideo(env, script, config, callbackUrl);
        await updateVideoDraft(env, draftId, chatId, {
            status: 'generating',
            heygen_video_id: heygenVideoId,
        });

        return {
            text: `⏳ <b>Generating Video</b>\n\nYour video is being generated by HeyGen.\nJob ID: <code>${heygenVideoId}</code>\n\nYou'll be notified when it's ready (usually 2-10 minutes).`,
            keyboard: [[{ text: '◀️ Back', callback_data: draft.repo_id ? `view:video_repo:${draft.repo_id}` : 'view:video_studio' }]],
        };
    } catch (error) {
        logError('Video approval/generation failed:', error instanceof Error ? error.message : String(error));
        return {
            text: `❌ <b>Generation Failed</b>\n\n${error instanceof Error ? error.message : 'Unknown error'}`,
            keyboard: [
                [{ text: '🔄 Retry', callback_data: `action:video_approve_script:${draftId}` }],
                [{ text: '◀️ Back', callback_data: `view:video_detail:${draftId}` }],
            ],
        };
    }
}

// ==================== REGENERATE SCRIPT (8.5) ====================

export async function videoRegenAction(ctx: HandlerContext & { value: string; extra?: string }): Promise<ViewResult | void> {
    const { env, chatId, extra: draftId } = ctx;
    if (!draftId) return;

    const draft = await getVideoDraft(env, draftId, chatId);
    if (!draft) return { text: '❌ Video draft not found.', keyboard: [[{ text: '🏠 Home', callback_data: 'view:home' }]] };

    const config = JSON.parse(draft.config || '{}') as VideoConfig;
    const overview = draft.repo_id ? await getRepoOverview(env, draft.repo_id, chatId) : null;

    try {
        const script = await generateVideoScript(env, {
            overview,
            tone: config.tone,
            length: config.length,
            manualInstructions: config.manualInstructions,
            emotion: config.emotion,
            textOverlayEnabled: config.textOverlay,
        });

        await updateVideoDraft(env, draftId, chatId, {
            script: JSON.stringify(script),
            caption: script.caption,
            twitter_caption: script.twitterCaption,
            title: script.title,
            status: 'draft',
        });

        const updatedDraft = await getVideoDraft(env, draftId, chatId);
        if (!updatedDraft) throw new Error('Failed to retrieve updated draft');

        return renderScriptPreview(updatedDraft, script, config);
    } catch (error) {
        logError('Script regeneration failed:', error instanceof Error ? error.message : String(error));
        return {
            text: `❌ Script regeneration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            keyboard: [[{ text: '◀️ Back', callback_data: `view:video_detail:${draftId}` }]],
        };
    }
}

// ==================== DELETE VIDEO (8.x) ====================

export async function videoDeleteAction(ctx: HandlerContext & { value: string; extra?: string }): Promise<ViewResult | void> {
    const { env, chatId, extra: draftId } = ctx;
    if (!draftId) return;

    const draft = await getVideoDraft(env, draftId, chatId);
    if (!draft) return { text: '❌ Video not found.', keyboard: [[{ text: '🏠 Home', callback_data: 'view:home' }]] };

    await deleteVideoDraft(env, draftId, chatId);

    return {
        text: '🗑 Video draft deleted.',
        keyboard: [[{ text: '◀️ Back', callback_data: draft.repo_id ? `view:video_repo:${draft.repo_id}` : 'view:video_studio' }]],
    };
}

// ==================== PUBLISH VIDEO (10.3) ====================

export async function videoPublishAction(ctx: HandlerContext & { value: string; extra?: string }): Promise<ViewResult | void> {
    const { env, chatId, extra: draftId } = ctx;
    if (!draftId) return;

    const draft = await getVideoDraft(env, draftId, chatId);
    if (!draft) return { text: '❌ Video not found.', keyboard: [[{ text: '🏠 Home', callback_data: 'view:home' }]] };

    const hasInstagram = !!(env.INSTAGRAM_ACCESS_TOKEN && env.INSTAGRAM_BUSINESS_ACCOUNT_ID);

    return {
        text: '📢 <b>Publish Video</b>\n\nSelect platforms to publish to:',
        keyboard: [
            [{ text: '🐦 Twitter', callback_data: `action:video_pub_twitter:${draftId}` }],
            [{ text: hasInstagram ? '📸 Instagram' : '📸 Instagram (not configured)', callback_data: hasInstagram ? `action:video_pub_instagram:${draftId}` : `action:video_pub_na:${draftId}` }],
            [{ text: '🐦+📸 Both', callback_data: hasInstagram ? `action:video_pub_both:${draftId}` : `action:video_pub_na:${draftId}` }],
            [{ text: '◀️ Back', callback_data: `view:video_detail:${draftId}` }],
        ],
    };
}

// ==================== SCHEDULE VIDEO (10.5) ====================

export async function videoScheduleAction(ctx: HandlerContext & { value: string; extra?: string }): Promise<ViewResult | void> {
    const { env, chatId, extra: draftId } = ctx;
    if (!draftId) return;

    // For now, show a simple "schedule" prompt — can enhance later with time picker
    await updateChatState(env, chatId, {
        context: { awaiting_input: 'schedule', selected_video_draft_id: draftId } as any,
    });

    return {
        text: '📅 <b>Schedule Video</b>\n\nSend the date and time (UTC) to publish:\n\nFormat: <code>YYYY-MM-DD HH:MM</code>\nExample: <code>2026-02-15 14:00</code>',
        keyboard: [[{ text: '❌ Cancel', callback_data: `view:video_detail:${draftId}` }]],
    };
}

// ==================== PLATFORM PUBLISH HANDLERS (10.3/10.4) ====================

export async function videoPubTwitterAction(ctx: HandlerContext & { value: string; extra?: string }): Promise<ViewResult | void> {
    const { env, chatId, extra: draftId } = ctx;
    if (!draftId) return;

    const draft = await getVideoDraft(env, draftId, chatId);
    if (!draft || !draft.video_url) return { text: '❌ Video not found or not ready.', keyboard: [[{ text: '🏠 Home', callback_data: 'view:home' }]] };

    try {
        const { publishVideoToTwitter } = await import('../services/video-publish');
        const twitterUrl = await publishVideoToTwitter(env, draft);

        if (!twitterUrl) throw new Error('Twitter publish returned no URL');

        const { createVideoPublished } = await import('../services/db');
        await createVideoPublished(env, chatId, {
            video_draft_id: draftId,
            repo_id: draft.repo_id || undefined,
            twitter_url: twitterUrl,
            caption: draft.twitter_caption || draft.caption || undefined,
        });
        await updateVideoDraft(env, draftId, chatId, { status: 'published' });

        return {
            text: `✅ <b>Published to Twitter!</b>\n\n${twitterUrl}`,
            keyboard: [[{ text: '🏠 Home', callback_data: 'view:home' }]],
        };
    } catch (error) {
        logError('Twitter publish failed:', error instanceof Error ? error.message : String(error));
        return {
            text: `❌ Twitter publish failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            keyboard: [[{ text: '◀️ Back', callback_data: `view:video_detail:${draftId}` }]],
        };
    }
}

export async function videoPubInstagramAction(ctx: HandlerContext & { value: string; extra?: string }): Promise<ViewResult | void> {
    const { env, chatId, extra: draftId } = ctx;
    if (!draftId) return;

    const draft = await getVideoDraft(env, draftId, chatId);
    if (!draft || !draft.video_url) return { text: '❌ Video not found or not ready.', keyboard: [[{ text: '🏠 Home', callback_data: 'view:home' }]] };

    try {
        const { publishVideoToInstagram } = await import('../services/video-publish');
        const igUrl = await publishVideoToInstagram(env, draft);

        if (!igUrl) throw new Error('Instagram publish returned no URL');

        const { createVideoPublished } = await import('../services/db');
        await createVideoPublished(env, chatId, {
            video_draft_id: draftId,
            repo_id: draft.repo_id || undefined,
            instagram_url: igUrl,
            caption: draft.caption || undefined,
        });
        await updateVideoDraft(env, draftId, chatId, { status: 'published' });

        return {
            text: `✅ <b>Published to Instagram!</b>\n\n${igUrl}`,
            keyboard: [[{ text: '🏠 Home', callback_data: 'view:home' }]],
        };
    } catch (error) {
        logError('Instagram publish failed:', error instanceof Error ? error.message : String(error));
        return {
            text: `❌ Instagram publish failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            keyboard: [[{ text: '◀️ Back', callback_data: `view:video_detail:${draftId}` }]],
        };
    }
}

export async function videoPubBothAction(ctx: HandlerContext & { value: string; extra?: string }): Promise<ViewResult | void> {
    const { env, chatId, extra: draftId } = ctx;
    if (!draftId) return;

    const draft = await getVideoDraft(env, draftId, chatId);
    if (!draft || !draft.video_url) return { text: '❌ Video not found or not ready.', keyboard: [[{ text: '🏠 Home', callback_data: 'view:home' }]] };

    try {
        const { publishVideoToTwitter, publishVideoToInstagram } = await import('../services/video-publish');
        const { createVideoPublished } = await import('../services/db');

        const twitterUrl = await publishVideoToTwitter(env, draft);
        const igUrl = await publishVideoToInstagram(env, draft);

        await createVideoPublished(env, chatId, {
            video_draft_id: draftId,
            repo_id: draft.repo_id || undefined,
            twitter_url: twitterUrl || undefined,
            instagram_url: igUrl || undefined,
            caption: draft.caption || undefined,
        });
        await updateVideoDraft(env, draftId, chatId, { status: 'published' });

        const results: string[] = [];
        if (twitterUrl) results.push(`🐦 Twitter: ${twitterUrl}`);
        else results.push('🐦 Twitter: ❌ Failed');
        if (igUrl) results.push(`📸 Instagram: ${igUrl}`);
        else results.push('📸 Instagram: ❌ Failed');

        return {
            text: `📢 <b>Publish Results</b>\n\n${results.join('\n')}`,
            keyboard: [[{ text: '🏠 Home', callback_data: 'view:home' }]],
        };
    } catch (error) {
        logError('Multi-platform publish failed:', error instanceof Error ? error.message : String(error));
        return {
            text: `❌ Publish failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            keyboard: [[{ text: '◀️ Back', callback_data: `view:video_detail:${draftId}` }]],
        };
    }
}

export async function videoPubNaAction(ctx: HandlerContext & { value: string; extra?: string }): Promise<ViewResult | void> {
    const { extra: draftId } = ctx;
    return {
        text: '❌ <b>Instagram Not Configured</b>\n\nPlease configure your Instagram Business Account in Video Settings to enable Reels publishing.',
        keyboard: [
            [{ text: '⚙️ Video Settings', callback_data: 'vsettings:instagram' }],
            [{ text: '◀️ Back', callback_data: `view:video_detail:${draftId}` }],
        ],
    };
}
