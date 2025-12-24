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
            model: 'grok-4-1-fast-reasoning',
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

Respond ONLY with valid JSON in this format:
{
  "format": "single" or "thread",
  "tweets": [{ "text": "...", "index": 0 }, ...]
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
 * Generate an image for the post
 */
export async function generateImage(env: Env, content: DraftContent): Promise<string | null> {
    try {
        const prompt = buildImagePrompt(content);
        console.log('Generating image with prompt:', prompt);

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
