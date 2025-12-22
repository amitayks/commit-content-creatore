/**
 * Image generation service using Grok AI.
 */

import { API_KEYS } from '../constants.js';
import logger from '../utils/logger.js';
import { defaultApiRetryCondition, retryWithBackoff } from '../utils/retry.js';

/**
 * Grok image API endpoint
 */
const GROK_IMAGE_API = 'https://api.x.ai/v1/images/generations';

/**
 * Generated image result
 */
export interface GeneratedImage {
    /** Base64 encoded image data */
    data: Buffer;
    /** Image format (always 'jpeg' from Grok) */
    format: 'jpeg';
}

/**
 * Generate an image using Grok AI.
 */
export async function generateImage(prompt: string): Promise<GeneratedImage> {
    return retryWithBackoff(
        async () => {
            logger.info('Generating image with Grok', { promptLength: prompt.length });

            const response = await fetch(GROK_IMAGE_API, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${API_KEYS.GROK_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'grok-2-image',
                    prompt,
                    n: 1,
                    response_format: 'b64_json',
                }),
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Grok Image API error ${response.status}: ${error}`);
            }

            const data = (await response.json()) as {
                data: Array<{ b64_json: string }>;
            };

            if (!data.data?.[0]?.b64_json) {
                throw new Error('No image data in response');
            }

            const imageBuffer = Buffer.from(data.data[0].b64_json, 'base64');
            logger.info('Image generated successfully', { size: imageBuffer.length });

            return {
                data: imageBuffer,
                format: 'jpeg',
            };
        },
        { shouldRetry: defaultApiRetryCondition, context: 'generateImage', maxRetries: 2 }
    );
}

/**
 * Build an image prompt from draft content.
 */
export function buildImagePrompt(
    projectId: string,
    tweetText: string,
    style?: string
): string {
    // Extract key themes from the tweet
    const content = tweetText.slice(0, 150);

    const defaultStyle = 'modern, clean, professional tech illustration, dark mode aesthetic, minimal design';
    const imageStyle = style || defaultStyle;

    return `Create a visually striking image for a developer announcement tweet.

Project: ${projectId}
Content context: ${content}

Style requirements:
- ${imageStyle}
- Suitable for Twitter/X tech audience
- No text in the image
- Abstract or symbolic representation of the theme
- High contrast, vibrant accents on dark background`;
}

/**
 * Image service singleton instance.
 */
export const imageService = {
    generateImage,
    buildImagePrompt,
};
