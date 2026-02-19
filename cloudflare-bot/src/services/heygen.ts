/**
 * HeyGen API Service — video generation, Photo Avatar management, voice listing
 *
 * API v2 client with typed requests, error handling, and credit estimation.
 */

import type { Env, VideoConfig, VideoScriptResponse, HeyGenJobStatus, HeyGenEmotion } from '../types';
import { logInfo, logError } from './security';

const HEYGEN_BASE_URL = 'https://api.heygen.com';

// ==================== TYPED ERRORS ====================

export class HeyGenError extends Error {
    constructor(
        message: string,
        public statusCode: number,
        public errorCode?: string
    ) {
        super(message);
        this.name = 'HeyGenError';
    }
}

// ==================== API CLIENT ====================

async function heygenRequest<T>(
    env: Env,
    method: string,
    path: string,
    body?: unknown,
    timeoutMs = 30000
): Promise<T> {
    if (!env.HEYGEN_API_KEY) {
        throw new HeyGenError('HeyGen API key not configured', 401);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(`${HEYGEN_BASE_URL}${path}`, {
            method,
            headers: {
                'x-api-key': env.HEYGEN_API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal,
        });

        if (response.status === 429) {
            throw new HeyGenError('Rate limited by HeyGen API. Please try again later.', 429);
        }
        if (response.status === 401) {
            throw new HeyGenError('HeyGen API authentication failed. Check your API key.', 401);
        }
        if (response.status === 402) {
            throw new HeyGenError('Insufficient HeyGen credits.', 402);
        }
        if (!response.ok) {
            const text = await response.text().catch(() => 'Unknown error');
            logError(`HeyGen API ${method} ${path} failed:`, response.status, text);
            if (body) logError(`HeyGen request body was:`, JSON.stringify(body).substring(0, 500));
            throw new HeyGenError(`HeyGen API error: ${response.status} — ${text}`, response.status, text);
        }

        return await response.json() as T;
    } catch (error) {
        if (error instanceof HeyGenError) throw error;
        if (error instanceof DOMException && error.name === 'AbortError') {
            throw new HeyGenError('HeyGen API request timed out', 408);
        }
        throw new HeyGenError(`Network error: ${error instanceof Error ? error.message : String(error)}`, 0);
    } finally {
        clearTimeout(timeout);
    }
}

// ==================== VIDEO GENERATION (Avatar IV) ====================

interface CreateAvatarIVRequest {
    image_key: string;
    video_title: string;
    script: string;
    voice_id: string;
    dimension: { width: number; height: number };
    aspect_ratio?: string;
    caption?: boolean;
    callback_url?: string;
    emotion?: string;
    talking_style?: string;
    custom_motion_prompt?: string;
    enhance_custom_motion_prompt?: boolean;
}

interface CreateVideoResponse {
    data: {
        video_id: string;
    };
}

/**
 * Create a video via HeyGen Avatar IV endpoint (/v2/video/av4/generate)
 * Uses image_key (from asset upload) for the avatar image.
 * Multi-scene scripts are concatenated; motion prompts are combined.
 */
export async function createVideo(
    env: Env,
    script: VideoScriptResponse,
    config: VideoConfig,
    callbackUrl?: string
): Promise<string> {
    const dimension = getDimension(config.aspectRatio);
    const voiceId = config.voiceId || '';
    const imageKey = config.imageKey || '';

    const fullScript = script.scenes.map(s => s.scriptText).join('\n\n');

    const motionPrompt = script.scenes
        .map(s => s.motionPrompt)
        .filter(Boolean)
        .join('. ') || 'Avatar speaks naturally with subtle gestures';

    const requestBody: CreateAvatarIVRequest = {
        image_key: imageKey,
        video_title: script.title || 'Video',
        script: fullScript,
        voice_id: voiceId,
        dimension,
        aspect_ratio: config.aspectRatio,
        caption: config.captions,
        emotion: script.scenes[0]?.emotion || config.emotion,
        talking_style: 'expressive',
        custom_motion_prompt: motionPrompt,
        enhance_custom_motion_prompt: true,
    };

    if (callbackUrl) {
        requestBody.callback_url = callbackUrl;
    }

    logInfo('HeyGen av4 request:', JSON.stringify({
        image_key: requestBody.image_key,
        voice_id: requestBody.voice_id,
        script_length: requestBody.script.length,
        dimension: requestBody.dimension,
        caption: requestBody.caption,
        emotion: requestBody.emotion,
        has_motion_prompt: !!requestBody.custom_motion_prompt,
        has_callback: !!requestBody.callback_url,
    }));

    const response = await heygenRequest<CreateVideoResponse>(env, 'POST', '/v2/video/av4/generate', requestBody, 60000);
    logInfo('HeyGen Avatar IV video created:', response.data.video_id);
    return response.data.video_id;
}

// ==================== VIDEO STATUS ====================

interface VideoStatusResponse {
    data: {
        video_id: string;
        status: 'pending' | 'processing' | 'completed' | 'failed';
        video_url?: string;
        error?: string;
    };
}

/**
 * Check video generation status
 */
export async function checkVideoStatus(env: Env, videoId: string): Promise<HeyGenJobStatus> {
    const response = await heygenRequest<VideoStatusResponse>(
        env, 'GET', `/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`
    );
    return {
        video_id: response.data.video_id,
        status: response.data.status,
        video_url: response.data.video_url,
        error: response.data.error,
    };
}

// ==================== VIDEO DOWNLOAD ====================

/**
 * Download a completed video from HeyGen (URLs expire after 7 days)
 */
export async function downloadVideo(
    env: Env,
    videoUrl: string
): Promise<{ data: ArrayBuffer; contentType: string; size: number }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000); // 2 min timeout

    try {
        const response = await fetch(videoUrl, { signal: controller.signal });
        if (!response.ok) {
            throw new HeyGenError(`Failed to download video: ${response.status}`, response.status);
        }

        const data = await response.arrayBuffer();
        const contentType = response.headers.get('content-type') || 'video/mp4';
        const maxSize = 200 * 1024 * 1024; // 200MB

        if (data.byteLength > maxSize) {
            throw new HeyGenError('Video exceeds 200MB size limit', 413);
        }

        return { data, contentType, size: data.byteLength };
    } finally {
        clearTimeout(timeout);
    }
}

// ==================== PHOTO AVATAR APIS ====================

interface UploadAssetResponse {
    code: number;
    data: {
        id: string;
        image_key?: string;
    };
}

/**
 * Upload an asset (image) to HeyGen for Photo Avatar creation
 * Uses upload.heygen.com with raw binary body (not multipart)
 */
export async function uploadAsset(
    env: Env,
    imageData: ArrayBuffer,
    filename: string
): Promise<string> {
    if (!env.HEYGEN_API_KEY) {
        throw new HeyGenError('HeyGen API key not configured', 401);
    }

    const contentType = filename.endsWith('.png') ? 'image/png' : 'image/jpeg';

    const response = await fetch('https://upload.heygen.com/v1/asset', {
        method: 'POST',
        headers: {
            'x-api-key': env.HEYGEN_API_KEY,
            'Content-Type': contentType,
        },
        body: imageData,
    });

    const body = await response.text();
    if (!response.ok) {
        logError('HeyGen asset upload failed:', response.status, body);
        throw new HeyGenError(`Failed to upload asset: ${response.status} ${body}`, response.status);
    }

    const result = JSON.parse(body) as UploadAssetResponse;
    const assetKey = result.data.image_key || result.data.id;
    logInfo('HeyGen asset uploaded, id:', result.data.id, 'image_key:', result.data.image_key, 'using:', assetKey);
    return assetKey;
}

interface AvatarGroupResponse {
    data: {
        group_id: string;
    };
}

/**
 * Create an avatar group from an uploaded asset
 */
export async function createAvatarGroup(env: Env, assetId: string, name: string): Promise<string> {
    const response = await heygenRequest<AvatarGroupResponse>(
        env, 'POST', '/v2/photo_avatar/avatar_group/create',
        { image_key: assetId, name }
    );
    logInfo('HeyGen avatar group created:', response.data.group_id);
    return response.data.group_id;
}

/**
 * Add additional photos (looks) to an existing avatar group
 * HeyGen limits to 4 image_keys per request, so we batch automatically.
 */
export async function addLooksToGroup(env: Env, groupId: string, assetIds: string[], groupName: string): Promise<void> {
    const BATCH_SIZE = 4;
    for (let i = 0; i < assetIds.length; i += BATCH_SIZE) {
        const batch = assetIds.slice(i, i + BATCH_SIZE);
        await heygenRequest(
            env, 'POST', '/v2/photo_avatar/avatar_group/add',
            { group_id: groupId, image_keys: batch, name: groupName }
        );
        logInfo('HeyGen added batch of', batch.length, 'looks to group:', groupId, `(${i + batch.length}/${assetIds.length})`);
    }
}

interface TrainResponse {
    data: {
        group_id: string;
        status?: string;
    };
}

/**
 * Train an avatar group to generate talking photo capabilities
 */
export async function trainAvatarGroup(env: Env, groupId: string): Promise<string> {
    const response = await heygenRequest<TrainResponse>(
        env, 'POST', '/v2/photo_avatar/train',
        { group_id: groupId }
    );
    logInfo('HeyGen avatar group training started:', groupId);
    return response.data.group_id;
}

interface ListAvatarsResponse {
    data: {
        avatars: Array<{
            avatar_id: string;
            avatar_name: string;
        }>;
        talking_photos: Array<{
            talking_photo_id: string;
            talking_photo_name: string;
            preview_image_url?: string;
        }>;
    };
}

/**
 * List available talking photos via GET /v2/avatars
 * This endpoint returns both standard avatars and talking photos.
 */
export async function listTalkingPhotos(env: Env): Promise<Array<{ id: string; name: string }>> {
    try {
        const response = await heygenRequest<ListAvatarsResponse>(
            env, 'GET', '/v2/avatars'
        );
        return (response.data.talking_photos || []).map(tp => ({
            id: tp.talking_photo_id,
            name: tp.talking_photo_name,
        }));
    } catch (error) {
        if (error instanceof HeyGenError && error.statusCode === 404) {
            logInfo('listTalkingPhotos: none found (404)');
            return [];
        }
        throw error;
    }
}

// ==================== AVATAR GROUP DETAILS ====================

interface AvatarGroupDetailResponse {
    error: string | null;
    data: {
        id: string;
        group_id?: string;
        name: string;
        status?: string;
        image_url?: string;
        talking_photos?: Array<{
            talking_photo_id: string;
            talking_photo_name: string;
            preview_image_url?: string;
        }>;
        looks?: Array<{
            id: string;
            name: string;
            talking_photo_id?: string;
            preview_image_url?: string;
        }>;
    };
}

/**
 * Get avatar group details and its looks via GET /v2/photo_avatar/<group_id>
 * Returns only the looks belonging to this specific group, not all account photos.
 * Falls back silently — returns empty array on failure so callers can use listTalkingPhotos.
 */
export async function getAvatarGroupLooks(env: Env, groupId: string): Promise<Array<{ id: string; name: string }>> {
    try {
        const response = await heygenRequest<AvatarGroupDetailResponse>(
            env, 'GET', `/v2/photo_avatar/${encodeURIComponent(groupId)}`
        );

        // Try talking_photos field first (most common response shape)
        if (response.data.talking_photos && response.data.talking_photos.length > 0) {
            return response.data.talking_photos.map(tp => ({
                id: tp.talking_photo_id,
                name: tp.talking_photo_name,
            }));
        }

        // Try looks field (alternative response shape)
        if (response.data.looks && response.data.looks.length > 0) {
            return response.data.looks
                .filter(l => l.talking_photo_id || l.id)
                .map(l => ({
                    id: l.talking_photo_id || l.id,
                    name: l.name,
                }));
        }

        logInfo('getAvatarGroupLooks: no looks found for group', groupId);
        return [];
    } catch (error) {
        logInfo('getAvatarGroupLooks failed for', groupId, ':', error instanceof Error ? error.message : String(error));
        return [];
    }
}

interface TrainStatusResponse {
    data: {
        status: 'pending' | 'processing' | 'completed' | 'failed';
    };
}

/**
 * Check avatar training status via GET /v2/photo_avatar/train/status/{group_id}
 */
export async function checkAvatarStatus(env: Env, groupId: string): Promise<string> {
    const response = await heygenRequest<TrainStatusResponse>(
        env, 'GET', `/v2/photo_avatar/train/status/${encodeURIComponent(groupId)}`
    );
    return response.data.status;
}

// ==================== VOICES ====================

export interface HeyGenVoice {
    voice_id: string;
    name: string;
    language: string;
    gender: string;
}

interface VoicesResponse {
    data: {
        voices: HeyGenVoice[];
    };
}

/**
 * List available HeyGen voices
 */
export async function listVoices(env: Env): Promise<HeyGenVoice[]> {
    const response = await heygenRequest<VoicesResponse>(env, 'GET', '/v2/voices');
    return response.data.voices || [];
}

// ==================== HELPERS ====================

/**
 * Map aspect ratio string to pixel dimensions
 */
export function getDimension(aspectRatio: string): { width: number; height: number } {
    switch (aspectRatio) {
        case '9:16': return { width: 1080, height: 1920 };
        case '16:9': return { width: 1920, height: 1080 };
        case '1:1': return { width: 1080, height: 1080 };
        default: return { width: 1080, height: 1920 };
    }
}

/**
 * Estimate HeyGen credit cost for Avatar IV
 * Avatar IV: ~1 Premium Credit per 3 seconds (~20 credits/min)
 * Average speaking rate: ~130 words per minute
 */
export function estimateCreditCost(wordCount: number): number {
    const minutes = wordCount / 130;
    const creditsPerMinute = 20; // Avatar IV: ~1 premium credit per 3 seconds
    return Math.ceil(minutes * creditsPerMinute * 10) / 10; // Round to 1 decimal
}

/**
 * Valid emotion values for HeyGen
 */
export const VALID_EMOTIONS: HeyGenEmotion[] = ['Excited', 'Friendly', 'Serious', 'Soothing', 'Broadcaster'];

/**
 * Validate an emotion value, returning fallback if invalid
 */
export function validateEmotion(emotion: string, fallback: HeyGenEmotion = 'Friendly'): HeyGenEmotion {
    return VALID_EMOTIONS.includes(emotion as HeyGenEmotion) ? (emotion as HeyGenEmotion) : fallback;
}
