/**
 * Image Storage Service — generates and persists images to R2
 *
 * Consolidates all image storage logic. Uses gemini.ts for generation,
 * env.IMAGES (R2) for persistence.
 */

import type { Env, DraftContent } from '../types';
import { generateImage } from './gemini';
import { logInfo, logError, isValidImageContentType, isValidFileSize } from './security';
import { getFileUrl } from './telegram';

/**
 * Generate an image and store it in R2
 * @returns R2 key path for the stored image, or null if failed
 */
export async function generateAndStoreImage(
    env: Env,
    content: DraftContent,
    draftId: string
): Promise<string | null> {
    try {
        const result = await generateImage(env, content);
        if (!result) {
            logInfo('No image data returned from generation');
            return null;
        }

        // SECURITY: Validate image content type
        if (!isValidImageContentType(result.mimeType)) {
            logError('Invalid image content type:', result.mimeType);
            return null;
        }

        // SECURITY: Validate file size (max 10MB)
        if (!isValidFileSize(result.data.byteLength)) {
            logError('Image file too large:', result.data.byteLength);
            return null;
        }

        // Store in R2
        const ext = result.mimeType === 'image/jpeg' ? 'jpg' : 'png';
        const key = `drafts/${draftId}/image.${ext}`;
        await env.IMAGES.put(key, result.data, {
            httpMetadata: { contentType: result.mimeType },
        });

        logInfo('Image stored in R2 for draft:', draftId);
        return key;
    } catch (error) {
        logError('generateAndStoreImage error:', error instanceof Error ? error.message : String(error));
        return null;
    }
}

/**
 * Ensure a draft has an image - check R2 first, generate if missing
 * @returns The image URL to display, or null if generation failed
 */
export async function ensureImage(
    env: Env,
    chatId: string,
    draft: { id: string; content: string; image_url?: string | null }
): Promise<string | null> {
    // If draft already has an image key, build the URL
    if (draft.image_url) {
        const existing = await env.IMAGES.get(draft.image_url);
        if (existing) {
            logInfo('Using existing R2 image for draft:', draft.id);
            return `/image/${draft.image_url}`;
        }
        logInfo('Image key exists but file missing, regenerating for draft:', draft.id);
    }

    // Parse content to generate image
    let content: DraftContent;
    try {
        content = JSON.parse(draft.content) as DraftContent;
    } catch {
        logError('Failed to parse draft content for image generation');
        return null;
    }

    // Generate and store
    logInfo('Generating image on-demand for draft:', draft.id);
    const imageKey = await generateAndStoreImage(env, content, draft.id);

    if (!imageKey) {
        return null;
    }

    // Save the image key to the database
    const { updateDraft } = await import('./db');
    await updateDraft(env, draft.id, chatId, { image_url: imageKey });
    logInfo('Saved image key to draft:', draft.id);

    return `/image/${imageKey}`;
}

/**
 * Download a user-sent photo from Telegram and store in R2
 * @returns R2 key or null if download/storage failed
 */
export async function storeUserMedia(
    env: Env,
    chatId: string,
    messageId: number,
    fileId: string
): Promise<string | null> {
    try {
        const downloadUrl = await getFileUrl(env, fileId);
        if (!downloadUrl) {
            logError('Failed to get file URL from Telegram for fileId:', fileId);
            return null;
        }

        const response = await fetch(downloadUrl);
        if (!response.ok) {
            logError('Failed to download file from Telegram:', response.status);
            return null;
        }

        const buffer = await response.arrayBuffer();

        // Validate file size (max 10MB)
        if (!isValidFileSize(buffer.byteLength)) {
            logError('User media file too large:', buffer.byteLength);
            return null;
        }

        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const ext = contentType.includes('png') ? 'png' : 'jpg';
        const key = `handwrite/${chatId}/${messageId}.${ext}`;

        await env.IMAGES.put(key, buffer, {
            httpMetadata: { contentType },
        });

        logInfo('Stored user media in R2:', key);
        return key;
    } catch (error) {
        logError('storeUserMedia error:', error instanceof Error ? error.message : String(error));
        return null;
    }
}

// ==================== VIDEO STORAGE ====================

const MAX_VIDEO_SIZE = 200 * 1024 * 1024; // 200MB

/**
 * Store a video file in R2
 * @returns R2 key path for the stored video, or null if failed
 */
export async function storeVideo(
    env: Env,
    videoDraftId: string,
    data: ArrayBuffer,
    mimeType: string
): Promise<string | null> {
    try {
        if (data.byteLength > MAX_VIDEO_SIZE) {
            logError('Video file too large:', data.byteLength);
            return null;
        }

        const key = `videos/${videoDraftId}/video.mp4`;
        await env.IMAGES.put(key, data, {
            httpMetadata: { contentType: mimeType || 'video/mp4' },
        });

        logInfo('Video stored in R2:', key, `(${Math.round(data.byteLength / 1024 / 1024)}MB)`);
        return key;
    } catch (error) {
        logError('storeVideo error:', error instanceof Error ? error.message : String(error));
        return null;
    }
}

