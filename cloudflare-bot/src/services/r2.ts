/**
 * R2 Storage Service - Image storage and retrieval
 */

import type { Env } from '../types';

/**
 * Upload an image to R2 storage
 * @returns Public URL of the uploaded image
 */
export async function uploadImage(
    env: Env,
    draftId: string,
    imageData: ArrayBuffer | Uint8Array,
    contentType: string = 'image/png'
): Promise<string> {
    const key = `drafts/${draftId}/image.png`;

    await env.IMAGES.put(key, imageData, {
        httpMetadata: {
            contentType,
        },
    });

    // Return the R2 public URL (requires public access enabled on bucket)
    // For now, we'll use the worker URL to serve images
    return key;
}

/**
 * Get image from R2 storage
 */
export async function getImage(
    env: Env,
    key: string
): Promise<{ data: ArrayBuffer; contentType: string } | null> {
    const object = await env.IMAGES.get(key);

    if (!object) {
        return null;
    }

    const data = await object.arrayBuffer();
    const contentType = object.httpMetadata?.contentType || 'image/png';

    return { data, contentType };
}

/**
 * Delete image from R2 storage
 */
export async function deleteImage(
    env: Env,
    draftId: string
): Promise<void> {
    const key = `drafts/${draftId}/image.png`;
    await env.IMAGES.delete(key);
}

/**
 * Get public URL for an image
 * Since R2 doesn't have built-in public URLs without a custom domain,
 * we'll serve through our worker at /image/{key}
 */
export function getImageUrl(draftId: string): string {
    return `/image/drafts/${draftId}/image.png`;
}

/**
 * Download image from URL and return as ArrayBuffer
 */
export async function downloadImage(url: string): Promise<ArrayBuffer | null> {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error('Failed to download image:', response.status);
            return null;
        }
        return await response.arrayBuffer();
    } catch (error) {
        console.error('Error downloading image:', error);
        return null;
    }
}
