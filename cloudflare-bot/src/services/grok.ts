/**
 * Grok Service - AI content and image generation
 */

import type { Env, PRData, CommitData, ContentSource, DraftContent } from '../types';

const GROK_API = 'https://api.x.ai/v1';

/**
 * Generate tweet content from a content source (PR or commit)
 */
export async function generateContent(env: Env, source: ContentSource): Promise<DraftContent> {
    const prompt = buildContentPrompt(source);

    const response = await fetch(`${GROK_API}/chat/completions`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${env.GROK_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'grok-3-fast',
            messages: [
                {
                    role: 'system',
                    content: `You are a developer advocate creating engaging Twitter/X posts about code changes. 
Your posts should be:
- Professional but engaging
- Technically accurate
- Include relevant emojis
- Never use hashtags unless specifically relevant
- Each tweet must be ≤ 280 characters

ALSO generate an imagePrompt - a detailed description for an AI image generator to create a visually striking image that represents this code change. The image should:
- Be futuristic, holographic, or modern tech aesthetic
- Include visual elements related to the specific code/feature (not generic)
- Be suitable for a developer Twitter audience
- Never include text in the image itself

Respond ONLY with valid JSON in this format:
{
  "format": "single" or "thread",
  "tweets": [{ "text": "...", "index": 0 }, ...],
  "imagePrompt": "Create a sleek, dark-themed..."
}`,
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            temperature: 0.7,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Grok API error: ${error}`);
    }

    const data = await response.json() as {
        choices: [{ message: { content: string } }];
    };

    const content = data.choices[0]?.message?.content;
    if (!content) {
        throw new Error('No content generated');
    }

    // Parse JSON response
    try {
        const parsed = JSON.parse(content) as DraftContent;

        // Validate structure
        if (!parsed.format || !Array.isArray(parsed.tweets)) {
            throw new Error('Invalid content structure');
        }

        // Ensure tweets have proper index
        parsed.tweets = parsed.tweets.map((t, i) => ({
            text: t.text.substring(0, 280), // Enforce limit
            index: i,
        }));

        return parsed;
    } catch {
        // If JSON parsing fails, treat as single tweet
        return {
            format: 'single',
            tweets: [{ text: content.substring(0, 280), index: 0 }],
        };
    }
}

/**
 * Edit/refine content based on user instructions
 */
export async function editContent(
    env: Env,
    currentContent: DraftContent,
    instruction: string
): Promise<DraftContent> {
    const currentTweets = currentContent.tweets.map(t => t.text).join('\n---\n');

    const response = await fetch(`${GROK_API}/chat/completions`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${env.GROK_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'grok-3-fast',
            messages: [
                {
                    role: 'system',
                    content: `You are editing Twitter/X posts. The user has existing content and wants changes.
Apply the user's instructions while:
- Keeping the same format (single/thread)
- Each tweet must be ≤ 280 characters
- Maintaining professional quality

Respond ONLY with valid JSON in this format:
{
  "format": "single" or "thread",
  "tweets": [{ "text": "...", "index": 0 }, ...],
  "imagePrompt": "Updated visual description..."
}`,
                },
                {
                    role: 'user',
                    content: `Current content (${currentContent.format}):
${currentTweets}

Instruction: ${instruction}

Apply this change and return the updated content as JSON.`,
                },
            ],
            temperature: 0.7,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Grok API error: ${error}`);
    }

    const data = await response.json() as { choices: [{ message: { content: string } }] };
    const content = data.choices[0]?.message?.content || '';

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('Failed to parse Grok response');
    }

    const parsed = JSON.parse(jsonMatch[0]) as DraftContent;

    // Enforce tweet limits
    parsed.tweets = parsed.tweets.map((t, i) => ({
        text: t.text.substring(0, 280),
        index: i,
    }));

    return parsed;
}

/**
 * Generate an image for the post
 */
export async function generateImage(env: Env, content: DraftContent): Promise<string | null> {
    try {
        // Use Grok-generated imagePrompt if available, otherwise build from content
        const prompt = content.imagePrompt || buildImagePrompt(content);
        console.log('Generating image with prompt:', prompt.substring(0, 200));

        const response = await fetch(`${GROK_API}/images/generations`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${env.GROK_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'grok-2-image-1212',
                prompt,
                n: 1,
            }),
        });

        const responseText = await response.text();
        console.log('Grok image API response status:', response.status);
        console.log('Grok image API response:', responseText);

        if (!response.ok) {
            console.error('Image generation failed:', responseText);
            return null;
        }

        const data = JSON.parse(responseText) as {
            data: [{ url?: string; b64_json?: string }];
        };

        const imageUrl = data.data[0]?.url;
        console.log('Generated image URL:', imageUrl);

        return imageUrl || null;
    } catch (error) {
        console.error('Image generation error:', error);
        return null;
    }
}

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
        // Generate the image
        const imageUrl = await generateImage(env, content);
        if (!imageUrl) {
            console.log('No image URL returned from generation');
            return null;
        }

        // Download the image
        const response = await fetch(imageUrl);
        if (!response.ok) {
            console.error('Failed to download generated image:', response.status);
            return null;
        }

        const imageData = await response.arrayBuffer();
        const contentType = response.headers.get('content-type') || 'image/png';

        // Store in R2
        const key = `drafts/${draftId}/image.png`;
        await env.IMAGES.put(key, imageData, {
            httpMetadata: { contentType },
        });

        console.log('Image stored in R2:', key);
        return key;
    } catch (error) {
        console.error('generateAndStoreImage error:', error);
        return null;
    }
}

/**
 * Ensure a draft has an image - check R2 first, generate if missing
 * @returns The image URL to display, or null if generation failed
 */
export async function ensureImage(
    env: Env,
    draft: { id: string; content: string; image_url?: string | null }
): Promise<string | null> {
    // If draft already has an image key, build the URL
    if (draft.image_url) {
        // Check if image exists in R2
        const existing = await env.IMAGES.get(draft.image_url);
        if (existing) {
            // Return worker URL to serve the image
            return `/image/${draft.image_url}`;
        }
        // Image key exists but file missing - regenerate
        console.log('Image key exists but file missing, regenerating...');
    }

    // Parse content to generate image
    let content: DraftContent;
    try {
        content = JSON.parse(draft.content) as DraftContent;
    } catch {
        console.error('Failed to parse draft content for image generation');
        return null;
    }

    // Generate and store
    console.log('Generating image on-demand for draft:', draft.id);
    const imageKey = await generateAndStoreImage(env, content, draft.id);

    if (!imageKey) {
        return null;
    }

    // Return the worker URL to serve the image
    return `/image/${imageKey}`;
}

/**
 * Build the prompt for content generation
 */
function buildContentPrompt(source: ContentSource): string {
    const { type, data } = source;
    const isSimple = data.files_changed <= 3 && data.additions + data.deletions < 100;

    if (type === 'pr') {
        const pr = data as PRData;
        return `Create a ${isSimple ? 'single tweet' : 'tweet thread (2-5 tweets)'} about this code change:

**PR Title**: ${pr.title}
**Author**: ${pr.author}
**Stats**: ${pr.files_changed} files, +${pr.additions} -${pr.deletions} lines
**Description**: ${pr.body || 'No description provided'}

${isSimple
                ? 'Keep it concise - this is a small change.'
                : 'First tweet should hook readers, following tweets add technical details.'}

Remember: JSON format only, each tweet ≤ 280 chars.`;
    } else {
        const commit = data as CommitData;
        return `Create a ${isSimple ? 'single tweet' : 'tweet thread (2-5 tweets)'} about this commit:

**Commit**: ${commit.title}
**Author**: ${commit.author}
**Stats**: ${commit.files_changed} files, +${commit.additions} -${commit.deletions} lines
**Details**: ${commit.body || 'No additional details'}

${isSimple
                ? 'Keep it concise - this is a small change.'
                : 'First tweet should hook readers, following tweets add technical details.'}

Remember: JSON format only, each tweet ≤ 280 chars.`;
    }
}

/**
 * Build the prompt for image generation
 */
function buildImagePrompt(content: DraftContent): string {
    const topic = content.tweets[0]?.text || 'software development';

    return `Create a modern, professional tech illustration for a Twitter post about: "${topic}". 
Style: Clean, minimalist, dark mode friendly, suitable for developer audience. 
No text in the image. Abstract or symbolic representation of the code/feature.`;
}
