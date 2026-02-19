/**
 * Video Studio Views — dashboard, repo home, lists, detail, config, script preview
 */

import type { Env, ViewResult, InlineButton, VideoDraft, VideoConfig, VideoScriptResponse } from '../types';
import { DEFAULT_VIDEO_CONFIG } from '../types';
import { getWatchingRepos, countVideoDraftsByRepo, getVideoDraftsByRepo, getVideoDraft } from '../services/db';
import { estimateCreditCost } from '../services/heygen';

// Short status codes for callback_data to stay under Telegram's 64-byte limit
const STATUS_TO_CODE: Record<string, string> = { draft: 'd', queued: 'q', generating: 'g', completed: 'c', approved: 'a', scheduled: 's', published: 'p', failed: 'f' };
export const STATUS_FROM_CODE: Record<string, string> = { d: 'draft', q: 'queued', g: 'generating', c: 'completed', a: 'approved', s: 'scheduled', p: 'published', f: 'failed' };

// ==================== VIDEO STUDIO HOME ====================

export async function renderVideoStudioHome(env: Env, chatId: string): Promise<ViewResult> {
    const repos = await getWatchingRepos(env, chatId);

    const keyboard: InlineButton[][] = [
        [{ text: '🎬 Standalone Video', callback_data: 'action:video_create:standalone' }],
    ];

    // Show all watched repos
    for (const repo of repos) {
        keyboard.push([{
            text: `📂 ${repo.owner}/${repo.repo}`,
            callback_data: `view:video_repo:${repo.id}`,
        }]);
    }

    if (repos.length === 0) {
        keyboard.push([{ text: '➕ Add Repo First', callback_data: 'view:repos' }]);
    }

    keyboard.push([{ text: '⚙️ Video Settings', callback_data: 'vsettings:home' }]);
    keyboard.push([{ text: '🏠 Home', callback_data: 'view:home' }]);

    return {
        text: `🎬 <b>Video Studio</b>\n\nCreate AI avatar videos from your code updates.\n\nSelect a repo or create a standalone video:`,
        keyboard,
    };
}

// ==================== REPO VIDEO HOME ====================

export async function renderVideoRepoHome(env: Env, chatId: string, repoId: string): Promise<ViewResult> {
    // Wrap each count in try/catch so one failure doesn't crash the whole view
    const safeCount = async (status: string): Promise<number> => {
        try {
            return await countVideoDraftsByRepo(env, chatId, repoId, status as any);
        } catch (e) {
            console.error(`countVideoDraftsByRepo failed for status=${status}, repoId=${repoId}:`, e instanceof Error ? e.message : String(e));
            return 0;
        }
    };
    const draftCount = await safeCount('draft');
    const completedCount = await safeCount('completed');
    const approvedCount = await safeCount('approved');
    const scheduledCount = await safeCount('scheduled');
    const publishedCount = await safeCount('published');
    const generatingCount = await safeCount('generating');
    const queuedCount = await safeCount('queued');
    const failedCount = await safeCount('failed');

    const keyboard: InlineButton[][] = [
        [{ text: `🆕 Create New Video`, callback_data: `action:video_create:${repoId}` }],
    ];

    if (draftCount > 0) keyboard.push([{ text: `📝 Drafts (${draftCount})`, callback_data: `view:video_list:${repoId}:d` }]);
    if (queuedCount > 0) keyboard.push([{ text: `📋 Queued (${queuedCount})`, callback_data: `view:video_list:${repoId}:q` }]);
    if (generatingCount > 0) keyboard.push([{ text: `⏳ Generating (${generatingCount})`, callback_data: `view:video_list:${repoId}:g` }]);
    if (completedCount > 0) keyboard.push([{ text: `✅ Completed (${completedCount})`, callback_data: `view:video_list:${repoId}:c` }]);
    if (approvedCount > 0) keyboard.push([{ text: `👍 Approved (${approvedCount})`, callback_data: `view:video_list:${repoId}:a` }]);
    if (scheduledCount > 0) keyboard.push([{ text: `📅 Scheduled (${scheduledCount})`, callback_data: `view:video_list:${repoId}:s` }]);
    if (publishedCount > 0) keyboard.push([{ text: `📢 Published (${publishedCount})`, callback_data: `view:video_list:${repoId}:p` }]);
    if (failedCount > 0) keyboard.push([{ text: `❌ Failed (${failedCount})`, callback_data: `view:video_list:${repoId}:f` }]);

    keyboard.push([{ text: '◀️ Back', callback_data: 'view:video_studio' }]);

    return {
        text: `🎬 <b>Video Studio</b>\n\nSelect a category or create a new video:`,
        keyboard,
    };
}

// ==================== VIDEO LIST ====================

export async function renderVideoList(
    env: Env,
    chatId: string,
    repoId: string,
    status: string,
    page = 0
): Promise<ViewResult> {
    const pageSize = 5;
    // Expand short code to full status if needed
    const fullStatus = STATUS_FROM_CODE[status] || status;
    const statusCode = STATUS_TO_CODE[fullStatus] || status;

    let drafts: VideoDraft[] = [];
    try {
        drafts = await getVideoDraftsByRepo(env, chatId, repoId, fullStatus as any, pageSize, page * pageSize);
    } catch (e) {
        console.error(`getVideoDraftsByRepo failed: status=${fullStatus}, repoId=${repoId}, page=${page}:`, e instanceof Error ? e.message : String(e));
    }

    const statusLabels: Record<string, string> = {
        draft: '📝 Drafts',
        queued: '📋 Queued',
        generating: '⏳ Generating',
        completed: '✅ Completed',
        approved: '👍 Approved',
        scheduled: '📅 Scheduled',
        published: '📢 Published',
        failed: '❌ Failed',
    };

    const keyboard: InlineButton[][] = [];

    for (const draft of drafts) {
        const title = draft.title || 'Untitled';
        const preview = title.length > 30 ? title.substring(0, 27) + '...' : title;
        const date = draft.created_at?.substring(0, 10) || '';
        keyboard.push([{
            text: `${preview} • ${date}`,
            callback_data: `view:video_detail:${draft.id}`,
        }]);
    }

    // Pagination — use short status code to stay under 64-byte limit
    const nav: InlineButton[] = [];
    if (page > 0) nav.push({ text: '◀️ Prev', callback_data: `view:video_list:${repoId}:${statusCode}:${page - 1}` });
    if (drafts.length === pageSize) nav.push({ text: 'Next ▶️', callback_data: `view:video_list:${repoId}:${statusCode}:${page + 1}` });
    if (nav.length > 0) keyboard.push(nav);

    keyboard.push([{ text: '◀️ Back', callback_data: `view:video_repo:${repoId}` }]);

    return {
        text: `${statusLabels[fullStatus] || fullStatus}\n\n${drafts.length === 0 ? 'No videos in this category.' : `Page ${page + 1}:`}`,
        keyboard,
    };
}

// ==================== VIDEO DETAIL ====================

export async function renderVideoDetail(env: Env, chatId: string, videoDraftId: string): Promise<ViewResult> {
    const draft = await getVideoDraft(env, videoDraftId, chatId);
    if (!draft) {
        return {
            text: '❌ Video not found.',
            keyboard: [[{ text: '🏠 Home', callback_data: 'view:home' }]],
        };
    }

    let script: VideoScriptResponse | null = null;
    try {
        script = draft.script ? JSON.parse(draft.script) : null;
    } catch { /* ignore */ }

    let config: VideoConfig | null = null;
    try {
        config = draft.config ? JSON.parse(draft.config) : null;
    } catch { /* ignore */ }

    const lines: string[] = [`🎬 <b>${draft.title || 'Untitled Video'}</b>`];
    lines.push(`Status: <b>${draft.status}</b>`);

    if (config) {
        lines.push(`\n${config.length} | ${config.aspectRatio}`);
        lines.push(`Emotion: ${config.emotion} | Captions: ${config.captions ? 'On' : 'Off'}`);
    }

    if (script) {
        lines.push(`\nScenes: ${script.scenes.length} | Words: ~${script.totalWordCount}`);
        // Show first scene preview
        const preview = script.scenes[0]?.scriptText || '';
        if (preview) {
            const truncated = preview.length > 150 ? preview.substring(0, 147) + '...' : preview;
            lines.push(`\n<i>"${truncated}"</i>`);
        }
    }

    if (draft.created_at) {
        lines.push(`\nCreated: ${draft.created_at.substring(0, 16)}`);
    }

    const keyboard: InlineButton[][] = [];

    // Status-specific actions
    switch (draft.status) {
        case 'draft':
            keyboard.push([{ text: '✅ Approve & Generate', callback_data: `action:video_approve_script:${draft.id}` }]);
            keyboard.push([{ text: '🔄 Regenerate Script', callback_data: `action:video_regen_script:${draft.id}` }]);
            keyboard.push([{ text: '🗑 Delete', callback_data: `action:video_delete:${draft.id}` }]);
            break;
        case 'completed':
            if (draft.video_url) {
                keyboard.push([{ text: '▶️ Watch', url: `${env.WORKER_URL}/media/${draft.video_url}` }]);
            }
            keyboard.push([{ text: '📢 Publish', callback_data: `action:video_publish:${draft.id}`, style: 'success' as const }]);
            keyboard.push([{ text: '📅 Schedule', callback_data: `action:video_schedule:${draft.id}` }]);
            keyboard.push([{ text: '🗑 Delete', callback_data: `action:video_delete:${draft.id}` }]);
            break;
        case 'approved':
            keyboard.push([{ text: '📢 Publish', callback_data: `action:video_publish:${draft.id}`, style: 'success' as const }]);
            keyboard.push([{ text: '📅 Schedule', callback_data: `action:video_schedule:${draft.id}` }]);
            break;
        case 'queued':
            lines.push('\n⏳ Preparing for generation...');
            keyboard.push([{ text: '🗑 Delete', callback_data: `action:video_delete:${draft.id}` }]);
            break;
        case 'generating':
            lines.push('\n⏳ Video is being generated by HeyGen...');
            if (draft.heygen_video_id) lines.push(`Job ID: <code>${draft.heygen_video_id}</code>`);
            break;
        case 'failed':
            keyboard.push([{ text: '🔄 Retry', callback_data: `action:video_approve_script:${draft.id}` }]);
            keyboard.push([{ text: '🗑 Delete', callback_data: `action:video_delete:${draft.id}` }]);
            break;
        case 'published':
            lines.push('\n✅ Published successfully.');
            break;
    }

    keyboard.push([{ text: '◀️ Back', callback_data: draft.repo_id ? `view:video_repo:${draft.repo_id}` : 'view:video_studio' }]);

    return { text: lines.join('\n'), keyboard };
}

// ==================== VIDEO CONFIG ====================

export function renderVideoConfig(
    repoId: string,
    config: VideoConfig,
    characterName?: string
): ViewResult {
    const depthLabel = config.commitDepth === 'since_last_video' ? 'Since last video'
        : config.commitDepth === 0 ? 'None (standalone)'
        : config.commitDepth === 1 ? 'Latest only'
        : `Last ${config.commitDepth}`;

    const charDisplay = config.talkingPhotoId
        ? `✅ ${characterName || 'Selected'}`
        : '❌ Not set';

    const lines: string[] = [
        '🎬 <b>Video Configuration</b>',
        '',
        `🎤  Tone:  <b>${config.tone}</b>`,
        `⏱  Length:  <b>${config.length}</b>`,
        `📐  Aspect:  <b>${config.aspectRatio}</b>`,
        `😀  Emotion:  <b>${config.emotion}</b>`,
        `📊  Commits:  <b>${depthLabel}</b>`,
        `👤  Character:  <b>${charDisplay}</b>`,
        '',
        `${config.captions ? '✅' : '❌'} Captions  ·  ${config.textOverlay ? '✅' : '❌'} Text Overlay`,
    ];

    if (config.manualInstructions) {
        lines.push('');
        lines.push('📝 <b>Instructions:</b>');
        const preview = config.manualInstructions.length > 200
            ? config.manualInstructions.substring(0, 197) + '...'
            : config.manualInstructions;
        lines.push(`<i>${preview}</i>`);
    }

    lines.push('');
    lines.push('<i>Tap a setting to cycle through options</i>');

    const keyboard: InlineButton[][] = [
        [{ text: `🎤 ${config.tone} ›`, callback_data: `vconfig:tone:${repoId}` }],
        [
            { text: `⏱ ${config.length} ›`, callback_data: `vconfig:length:${repoId}` },
            { text: `📐 ${config.aspectRatio} ›`, callback_data: `vconfig:aspect:${repoId}` },
        ],
        [{ text: `😀 ${config.emotion} ›`, callback_data: `vconfig:emotion:${repoId}` }],
        [{ text: `📊 ${depthLabel} ›`, callback_data: `vconfig:depth:${repoId}` }],
        [
            { text: `${config.captions ? '✅' : '❌'} Captions`, callback_data: `vconfig:captions:${repoId}` },
            { text: `${config.textOverlay ? '✅' : '❌'} Overlay`, callback_data: `vconfig:overlay:${repoId}` },
        ],
        [
            { text: `👤 ${config.talkingPhotoId ? '✅ Character' : 'Character'}`, callback_data: `vconfig:character:${repoId}` },
            { text: `📝 Instructions${config.manualInstructions ? ' ✎' : ''}`, callback_data: `vconfig:instructions:${repoId}` },
        ],
        [
            { text: '💾 Save Preset', callback_data: `vconfig:save_preset:${repoId}` },
            { text: '📂 Load Preset', callback_data: `vconfig:load_preset:${repoId}` },
        ],
        [{ text: '🎬 Create Video', callback_data: `action:video_generate:${repoId}` }],
        [{ text: '❌ Cancel', callback_data: repoId === 'standalone' ? 'view:video_studio' : `view:video_repo:${repoId}` }],
    ];

    return { text: lines.join('\n'), keyboard };
}

// ==================== SCRIPT PREVIEW ====================

export function renderScriptPreview(
    draft: VideoDraft,
    script: VideoScriptResponse,
    config: VideoConfig
): ViewResult {
    const lines: string[] = [`🎬 <b>Script Preview: ${script.title}</b>\n`];

    // Show scenes
    for (let i = 0; i < script.scenes.length; i++) {
        const scene = script.scenes[i];
        lines.push(`<b>Scene ${i + 1}</b> (${scene.emotion})`);
        const text = scene.scriptText.length > 200
            ? scene.scriptText.substring(0, 197) + '...'
            : scene.scriptText;
        lines.push(`<i>"${text}"</i>`);
        if (scene.textOverlay) lines.push(`📌 ${scene.textOverlay}`);
        lines.push('');
    }

    // Stats
    lines.push(`📊 <b>Stats:</b> ${script.scenes.length} scenes, ~${script.totalWordCount} words`);

    // Credit estimate (Avatar IV: ~1 premium credit per 3 seconds)
    const creditCost = estimateCreditCost(script.totalWordCount);
    lines.push(`💰 <b>Estimated Cost:</b> ~${creditCost} premium credits`);

    // Caption preview
    if (script.twitterCaption) {
        lines.push(`\n🐦 <b>Twitter:</b> ${script.twitterCaption}`);
    }

    const keyboard: InlineButton[][] = [
        [{ text: '✅ Approve & Generate', callback_data: `action:video_approve_script:${draft.id}` }],
        [{ text: '🔄 Regenerate', callback_data: `action:video_regen_script:${draft.id}` }],
        [{ text: '⚙️ Edit Config', callback_data: `action:video_create:${draft.repo_id || 'standalone'}` }],
        [{ text: '❌ Cancel', callback_data: `action:video_delete:${draft.id}` }],
    ];

    return { text: lines.join('\n'), keyboard };
}
