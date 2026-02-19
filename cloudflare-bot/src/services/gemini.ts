/**
 * AI Service - Content and image generation via Gemini
 *
 * SECURITY: Uses secure logging and sanitizes API error responses
 */

import type { Env, ContentSource, DraftContent, ImagePromptData, RepoOverview, OverviewPatch, ContentResponse, VideoScriptResponse, VideoScene, HeyGenEmotion } from '../types';
import { logInfo, logError, sanitizeContent } from './security';
import { getRepoOverview } from './db';

const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_TEXT_MODEL = 'gemini-3-pro-preview';
const GEMINI_IMAGE_MODEL = 'gemini-3-pro-image-preview';

/**
 * System prompt for content generation - multi-perspective creative approach
 */
const CONTENT_SYSTEM_PROMPT = `You are creating a complete social media package for a tech company's code changes — tweets and a visual image prompt.

Before generating anything, think through multiple expert perspectives and synthesize their insights:

FOR THE TWEETS, consider:
- Think from the perspective of a Tech Influencer — what hook would make developers stop mid-scroll? What pattern or format gets engagement in the dev community right now?
- Think from the perspective of a Copywriter — every character counts in 280 chars. What word choices create maximum impact? Where does punch beat explanation?
- Think from the perspective of a Growth Marketer — what makes someone hit retweet? What creates FOMO or curiosity? What framing makes this feel like a must-read?
- Think from the perspective of a Community Manager — what tone feels authentic to developers? What avoids feeling like corporate marketing? What sparks genuine conversation?
- Think from the perspective of a Storyteller — what narrative can you extract from these commits? Every code change has a story: a problem solved, a capability unlocked, a bottleneck removed.

FOR THE IMAGE — you are a professional visual prompt engineer. Your job is to create image prompts at the quality level of a senior art director at a top creative agency. Follow these principles:

SPECIFICITY IS EVERYTHING. Never use generic descriptions. Every detail must be precise and evocative:
- BAD: "dark background" → GOOD: "2 AM urban darkness, orange sodium streetlight casting harsh directional shadows, light fog diffusing distant signals"
- BAD: "blue colors" → GOOD: "deep Prussian blue transitioning to cerulean at the edges, accented with oxidized copper green"
- BAD: "tech aesthetic" → GOOD: "mixed-media collage combining vintage botanical illustration with precise architectural blueprints"
- BAD: "modern style" → GOOD: "editorial illustration inspired by Bauhaus poster design — bold geometry, limited palette, asymmetric balance"

BREAK OUT OF THE CYBER DEFAULT. Do NOT default to neon, circuit boards, holographic, or cyberpunk aesthetics. Instead, think across the full spectrum of visual art:
- Oil painting, watercolor, gouache, ink wash
- Analog photography (Kodak Portra 400 warmth, Fuji Velvia 50 saturation, Ilford HP5 grain)
- Editorial illustration, vintage poster design, Bauhaus, Art Deco, Art Nouveau
- Macro photography, architectural photography, aerial photography
- Mixed media collage, papercut art, woodblock print, linocut
- Sculptural/physical metaphors: ceramics, metalwork, glass-blowing, origami
Choose the medium that BEST serves the metaphor for THIS specific code change.

USE PROFESSIONAL VISUAL VOCABULARY in every field:
- Lighting: Rembrandt lighting, butterfly lighting, split lighting, rim/backlight, golden hour, blue hour, chiaroscuro, high-key, low-key
- Camera: 35mm f/1.4 shallow depth, 85mm portrait compression, 24mm wide environmental, tilt-shift miniature effect
- Color: specify temperature (warm 3000K, cool 7000K), name exact shades (burnt sienna, chartreuse, cerulean, raw umber)
- Composition: rule of thirds, golden ratio spiral, centered symmetry, leading lines, negative space, figure-ground contrast

THINK IN VISUAL METAPHORS — code is abstract, so find the perfect concrete metaphor:
- Authentication → a master locksmith hand-forging an intricate skeleton key
- Performance optimization → a hummingbird frozen mid-flight, wings razor-sharp
- Database migration → ancient scrolls being carefully transferred into illuminated manuscripts
- Bug fix → a watchmaker's loupe over delicate clockwork, tweezers adjusting a tiny gear
- New API → a grand bridge being completed, connecting two distinct landscapes
- Refactoring → a bonsai tree being carefully pruned, each cut deliberate and purposeful
DO NOT reuse these examples. Create your OWN unique metaphor specific to the actual code change.

QUALITY CHECKLIST — verify before output:
✓ No generic terms (no "modern", "sleek", "tech", "digital" without specific context)
✓ Colors named with precision (not "blue" but "cobalt", "navy", "cerulean")
✓ Lighting technique specified by name
✓ Medium chosen for artistic merit, not defaulted
✓ Visual metaphor is SPECIFIC to this code change, not reusable for any change
✓ Mood/atmosphere described with sensory detail

If a PROJECT OVERVIEW is provided in the user prompt, ground all perspectives in the project's identity: use brand_voice for tweet tone, target_audience for framing and relevance, and visual_theme for image direction and color choices.

Now synthesize all these perspectives into one cohesive output.

RULES:
- Each tweet MUST be ≤ 280 characters
- Include relevant emojis — they increase engagement
- Never use hashtags unless specifically relevant
- The imagePrompt MUST be a structured JSON object (not a string)
- Be specific to the actual code change, never generic

Respond ONLY with valid JSON in this exact format:
{
  "format": "single" or "thread",
  "tweets": [{ "text": "...", "index": 0 }, ...],
  "imagePrompt": {
    "concept": {
      "main_subject": "The ONE specific visual metaphor for this code change — concrete, vivid, not abstract",
      "symbolic_elements": "Supporting visual details that reinforce the metaphor with sensory richness",
      "mood": "The emotional atmosphere — described with feeling, not adjectives (e.g., 'the stillness right before a thunderstorm breaks')"
    },
    "composition": {
      "style": "Specific art movement or technique — e.g., 'Kodak Portra 400 analog photography with lifted shadows and warm cast' or 'gouache illustration with visible brushstrokes in the style of mid-century scientific diagrams'",
      "perspective": "Camera angle with technical precision — e.g., 'low-angle 24mm wide lens creating dramatic convergence' or 'overhead flat-lay at exactly 90 degrees'",
      "focal_point": "What the eye lands on first and what leads it through the composition"
    },
    "environment": {
      "setting": "A fully realized world — not 'abstract space' but a specific place with texture, atmosphere, and story",
      "lighting": "Named lighting technique with color temperature — e.g., 'Rembrandt lighting with warm 3200K key, cool 6500K fill from window'",
      "color_palette": "3-4 precisely named colors with their emotional role — e.g., 'burnt sienna (warmth, craft), ivory (space, breath), deep forest green (growth, stability)'"
    },
    "technical": {
      "medium": "The specific artistic medium chosen for its qualities — e.g., 'wet-plate collodion photography' or 'Japanese woodblock print (ukiyo-e)' or 'mixed media combining ink drawing with watercolor washes'",
      "quality": "The rendering intention — e.g., 'hand-crafted feel with visible material texture' or 'hyper-detailed photorealistic with shallow depth of field'",
      "negative": "Avoid generic stock-photo aesthetics"
    }
  },
  "overviewUpdates": null or {
    "summary": "new summary" or null,
    "tech_stack": "new tech stack" or null,
    "key_features": { "add": ["new feature"], "remove": ["old feature"] } or null,
    "target_audience": "new audience" or null,
    "brand_voice": "new voice" or null,
    "visual_theme": "new theme" or null,
    "recent_changes": { "add": ["brief description of this change"], "remove": [] } or null
  }
}

OVERVIEW UPDATES:
- If a PROJECT OVERVIEW section is provided below, analyze whether this code change represents meaningful project evolution.
- For minor fixes/typos: set overviewUpdates to null.
- For feature additions, architectural changes, or significant updates: return patches for affected fields only. Use null for unchanged fields.
- ALWAYS add a brief description to recent_changes.add when an overview is provided — even small changes are worth tracking.
- For key_features: only add genuinely new capabilities, only remove features that were replaced or deprecated by this change.
- Keep all text concise — summary should be 2-3 sentences, not paragraphs.
- If NO overview is provided, set overviewUpdates to null.`;

/**
 * System prompt for editing content
 */
const EDIT_SYSTEM_PROMPT = `You are refining a social media package for a tech company. The user has existing tweets and wants changes.

Apply the user's instructions while thinking through these perspectives:
- As a Copywriter: Does each word earn its place in 280 characters?
- As a Tech Influencer: Does the hook still grab attention after the edit?
- As a Community Manager: Does the tone still feel authentic to developers?
- As an Art Director: Does the image prompt still match the updated content direction?

FOR THE IMAGE PROMPT — maintain professional visual quality:
- Never use generic terms. Every color must be precisely named (not "blue" but "cerulean" or "Prussian blue").
- Avoid defaulting to cyber/neon/holographic aesthetics. Consider the full range: oil painting, analog photography, editorial illustration, mixed media, watercolor, woodblock print.
- Specify lighting by professional name (Rembrandt, butterfly, rim light, chiaroscuro).
- The visual metaphor must be specific to the code change, not generic tech imagery.

RULES:
- Keep the same format (single/thread) unless the instruction explicitly changes it
- Each tweet MUST be ≤ 280 characters
- The imagePrompt MUST be a structured JSON object (not a string)

Respond ONLY with valid JSON in this exact format:
{
  "format": "single" or "thread",
  "tweets": [{ "text": "...", "index": 0 }, ...],
  "imagePrompt": {
    "concept": {
      "main_subject": "Specific visual metaphor — concrete and vivid",
      "symbolic_elements": "Supporting details with sensory richness",
      "mood": "Emotional atmosphere described with feeling"
    },
    "composition": {
      "style": "Specific art movement, technique, or photographic approach",
      "perspective": "Camera angle with technical precision",
      "focal_point": "What draws the eye and guides it through the image"
    },
    "environment": {
      "setting": "A fully realized space with texture and atmosphere",
      "lighting": "Named lighting technique with color temperature",
      "color_palette": "3-4 precisely named colors with their emotional role"
    },
    "technical": {
      "medium": "Specific artistic medium chosen for its qualities",
      "quality": "Rendering intention and detail level",
      "negative": "Avoid generic stock-photo aesthetics"
    }
  }
}`;

/**
 * System prompt for extracting structured overview from README + PRs
 */
const OVERVIEW_EXTRACTION_PROMPT = `You are analyzing a GitHub repository to extract a structured project overview. You will be given the repository README (if available) and recent merged PR titles/descriptions.

Extract the following fields as a JSON object. Be concise — the total overview should be ~500-1000 words across all fields.

{
  "summary": "2-3 sentence project description — what it does, why it exists, what problem it solves",
  "tech_stack": "Comma-separated list of key technologies, frameworks, and platforms (e.g., 'TypeScript, Cloudflare Workers, D1, R2, Gemini API, Telegram Bot API')",
  "key_features": ["Feature 1", "Feature 2", ...],  // Max 10 items, each a short phrase
  "target_audience": "1-2 sentences describing who uses this and why",
  "brand_voice": "1-2 sentences describing the tone and style for social media content about this project",
  "visual_theme": "1-2 sentences describing colors, visual style, and mood for image generation consistency",
  "recent_changes": ["Recent change 1", "Recent change 2", ...]  // From PR titles, max 10 most recent
}

RULES:
- If README is missing or sparse, infer what you can from PR titles and descriptions
- key_features should be genuinely distinct capabilities, not generic ("has a UI" is bad, "Telegram bot dashboard with inline keyboards" is good)
- brand_voice should guide tweet tone — is this project serious/professional, casual/fun, technical/precise?
- visual_theme should guide image generation — specify color preferences, aesthetic style, mood
- Respond ONLY with valid JSON, no prose or markdown`;

/**
 * Extract a structured overview from README + PR data
 */
export async function extractRepoOverview(
    env: Env,
    readmeText: string | null,
    prSummaries: { title: string; body: string }[]
): Promise<{
    summary: string | null;
    tech_stack: string | null;
    key_features: string[];
    target_audience: string | null;
    brand_voice: string | null;
    visual_theme: string | null;
    recent_changes: string[];
}> {
    const readmeSection = readmeText
        ? `## README\n\n${readmeText.substring(0, 8000)}`
        : '## README\n\nNo README available.';

    const prSection = prSummaries.length > 0
        ? `## Recent Merged PRs\n\n${prSummaries.map(pr => `- **${pr.title}**: ${pr.body.substring(0, 200)}`).join('\n')}`
        : '## Recent Merged PRs\n\nNo recent PRs available.';

    const userPrompt = `${readmeSection}\n\n${prSection}`;

    const responseText = await callGeminiText(env, OVERVIEW_EXTRACTION_PROMPT, userPrompt);

    try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON in extraction response');

        const parsed = JSON.parse(jsonMatch[0]);
        return {
            summary: parsed.summary || null,
            tech_stack: parsed.tech_stack || null,
            key_features: Array.isArray(parsed.key_features) ? parsed.key_features.slice(0, 10) : [],
            target_audience: parsed.target_audience || null,
            brand_voice: parsed.brand_voice || null,
            visual_theme: parsed.visual_theme || null,
            recent_changes: Array.isArray(parsed.recent_changes) ? parsed.recent_changes.slice(0, 10) : [],
        };
    } catch (error) {
        logError('Overview extraction parse error:', error instanceof Error ? error.message : String(error));
        return {
            summary: null,
            tech_stack: null,
            key_features: [],
            target_audience: null,
            brand_voice: null,
            visual_theme: null,
            recent_changes: [],
        };
    }
}

/**
 * Validate that an object matches the ImagePromptData shape
 */
function isValidImagePromptData(obj: unknown): obj is ImagePromptData {
    if (!obj || typeof obj !== 'object') return false;
    const o = obj as Record<string, unknown>;
    return (
        typeof o.concept === 'object' && o.concept !== null &&
        typeof o.composition === 'object' && o.composition !== null &&
        typeof o.environment === 'object' && o.environment !== null &&
        typeof o.technical === 'object' && o.technical !== null
    );
}

/**
 * Build a fallback ImagePromptData from tweet content
 */
function buildImagePrompt(content: DraftContent): ImagePromptData {
    const topic = content.tweets[0]?.text || 'software development';

    return {
        concept: {
            main_subject: `Visual metaphor inspired by: ${topic.substring(0, 100)}`,
            symbolic_elements: 'Organic forms suggesting growth and transformation — unfurling leaves, branching patterns, crystalline structures forming',
            mood: 'The quiet confidence of something well-crafted — precision meeting elegance',
        },
        composition: {
            style: 'Editorial illustration with influences from mid-century scientific diagrams — clean linework with rich color fills',
            perspective: 'Centered composition with generous negative space, golden ratio proportions',
            focal_point: 'A single striking central element surrounded by purposeful whitespace',
        },
        environment: {
            setting: 'Warm workshop atmosphere — a craftsperson\'s bench with tools of precision, rich wood grain textures, soft natural materials',
            lighting: 'Warm golden hour light from the left (3200K key), with soft cool fill (5500K) creating gentle dimensional shadows',
            color_palette: 'Warm ivory (space, breath), deep indigo (depth, intelligence), burnished copper (craft, warmth), sage green (growth, balance)',
        },
        technical: {
            medium: 'Mixed media — ink line drawing with watercolor washes and subtle gold leaf accents',
            quality: 'Hand-crafted feel with visible material texture, slight paper grain, intentional imperfection that conveys human touch',
            negative: 'Avoid generic stock-photo aesthetics, no neon, no circuit boards, no holographic effects',
        },
    };
}

/**
 * Generate tweet content from a content source (PR or commit)
 * If repoId is provided, fetches the repo overview from D1 to enrich the prompt.
 */
export async function generateContent(env: Env, source: ContentSource, repoId?: string): Promise<ContentResponse> {
    // Fetch overview if repoId is provided
    let overview: RepoOverview | null = null;
    if (repoId) {
        try {
            overview = await getRepoOverview(env, repoId);
        } catch (e) {
            logError('Failed to fetch repo overview:', e instanceof Error ? e.message : String(e));
        }
    }

    const prompt = buildContentPrompt(source, overview);
    const responseText = await callGeminiText(env, CONTENT_SYSTEM_PROMPT, prompt);
    return parseContentResponse(responseText);
}

/**
 * Call Gemini text model with system instruction and user prompt
 */
async function callGeminiText(env: Env, systemPrompt: string, userPrompt: string): Promise<string> {
    const url = `${GEMINI_API}/models/${GEMINI_TEXT_MODEL}:generateContent?key=${env.GOOGLE_API_KEY}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            generationConfig: {
                temperature: 0.7,
                responseMimeType: 'application/json',
            },
        }),
    });

    if (!response.ok) {
        const errText = await response.text();
        logError('Gemini API failed:', response.status, errText.substring(0, 200));
        throw new Error('Content generation failed. Please try again.');
    }

    const data = await response.json() as {
        candidates?: [{ content?: { parts?: [{ text?: string }] } }];
    };

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
        throw new Error('No content generated');
    }

    return content;
}

/**
 * Parse content response from Gemini into DraftContent and optional overviewUpdates
 */
function parseContentResponse(content: string): ContentResponse {
    // Extract JSON from response (model may wrap in code fences)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        logError('No JSON found in response, first 200 chars:', content.substring(0, 200));
        const fallbackContent: DraftContent = {
            format: 'single',
            tweets: [{ text: content.replace(/```[\s\S]*?```/g, '').trim().substring(0, 280), index: 0 }],
        };
        fallbackContent.imagePrompt = buildImagePrompt(fallbackContent);
        return { content: fallbackContent, overviewUpdates: null };
    }

    try {
        const parsed = JSON.parse(jsonMatch[0]);

        if (!parsed.format || !Array.isArray(parsed.tweets)) {
            throw new Error('Invalid content structure');
        }

        const draftContent: DraftContent = {
            format: parsed.format,
            tweets: parsed.tweets.map((t: { text: string }, i: number) => ({
                text: t.text.substring(0, 280),
                index: i,
            })),
        };

        logInfo('Response has imagePrompt:', !!parsed.imagePrompt, 'type:', typeof parsed.imagePrompt);

        if (parsed.imagePrompt && isValidImagePromptData(parsed.imagePrompt)) {
            draftContent.imagePrompt = parsed.imagePrompt;
        } else {
            if (parsed.imagePrompt) logInfo('imagePrompt failed validation, using fallback');
            else logInfo('No imagePrompt in response, generating fallback');
            draftContent.imagePrompt = buildImagePrompt(draftContent);
        }

        // Extract overviewUpdates if present
        let overviewUpdates: OverviewPatch | null = null;
        if (parsed.overviewUpdates && typeof parsed.overviewUpdates === 'object') {
            overviewUpdates = parsed.overviewUpdates as OverviewPatch;
        }

        return { content: draftContent, overviewUpdates };
    } catch (parseError) {
        logError('JSON parse error:', parseError instanceof Error ? parseError.message : String(parseError));
        const fallbackContent: DraftContent = {
            format: 'single',
            tweets: [{ text: content.replace(/```[\s\S]*?```/g, '').trim().substring(0, 280), index: 0 }],
        };
        fallbackContent.imagePrompt = buildImagePrompt(fallbackContent);
        return { content: fallbackContent, overviewUpdates: null };
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

    const userPrompt = `Current content (${currentContent.format}):
${currentTweets}

Instruction: ${instruction}

Apply this change and return the updated content as JSON.`;

    const content = await callGeminiText(env, EDIT_SYSTEM_PROMPT, userPrompt);
    return parseContentResponse(content).content;
}

/**
 * Build a natural language prompt string from ImagePromptData.
 * Joins all fields into a flowing description for the image model.
 */
function consolidateImagePrompt(data: ImagePromptData): string {
    return [
        data.concept.main_subject,
        data.concept.symbolic_elements,
        data.concept.mood,
        data.composition.style,
        data.composition.perspective,
        data.environment.setting,
        data.environment.lighting,
        data.environment.color_palette,
        data.technical.medium,
        data.technical.quality,
        data.technical.negative,
    ].join('. ');
}

/**
 * Generate an image using Gemini image generation.
 * Returns the raw image data as ArrayBuffer, or null if failed.
 */
export async function generateImage(env: Env, content: DraftContent): Promise<{ data: ArrayBuffer; mimeType: string } | null> {
    try {
        // Build the prompt string
        let promptStr: string;

        if (content.imagePrompt) {
            if (typeof content.imagePrompt === 'string') {
                promptStr = content.imagePrompt;
            } else {
                promptStr = consolidateImagePrompt(content.imagePrompt);
            }
        } else {
            promptStr = consolidateImagePrompt(buildImagePrompt(content));
        }

        logInfo('Generating image with Gemini, prompt length:', promptStr.length);

        const url = `${GEMINI_API}/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${env.GOOGLE_API_KEY}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `Generate an image: ${promptStr}` }] }],
                generationConfig: {
                    responseModalities: ['IMAGE', 'TEXT'],
                },
            }),
        });

        logInfo('Gemini image API response status:', response.status);

        if (!response.ok) {
            const errText = await response.text();
            logError('Gemini image generation failed:', response.status, errText.substring(0, 200));
            return null;
        }

        const result = await response.json() as {
            candidates?: [{
                content?: {
                    parts?: Array<{
                        text?: string;
                        inlineData?: { mimeType: string; data: string };
                    }>;
                };
            }];
        };

        // Find the image part in the response
        const parts = result.candidates?.[0]?.content?.parts || [];
        const imagePart = parts.find(p => p.inlineData);

        if (!imagePart?.inlineData) {
            logError('No image data in Gemini response, parts count:', parts.length);
            return null;
        }

        // Decode base64 to ArrayBuffer
        const binaryStr = atob(imagePart.inlineData.data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
        }

        logInfo('Image generated successfully, size:', bytes.length);
        return { data: bytes.buffer, mimeType: imagePart.inlineData.mimeType };
    } catch (error) {
        logError('Image generation error:', error instanceof Error ? error.message : String(error));
        return null;
    }
}

/**
 * Refine handwritten tweets — polish grammar, clarity, impact while preserving voice, count, and order.
 * Optionally generates an imagePrompt.
 */
export async function refineHandwrittenContent(
    env: Env,
    content: DraftContent,
    options: { refineText: boolean; generateImagePrompt: boolean }
): Promise<DraftContent> {
    const tweetsText = content.tweets.map((t, i) => `Tweet ${i + 1}: ${t.text}`).join('\n');

    let instruction: string;
    if (options.refineText && options.generateImagePrompt) {
        instruction = `Polish these handwritten tweets for grammar, clarity, and engagement impact. Preserve the author's voice, tone, and intent. Keep the EXACT same number of tweets (${content.tweets.length}) in the SAME order. Also generate an imagePrompt for the thread.`;
    } else if (options.refineText) {
        instruction = `Polish these handwritten tweets for grammar, clarity, and engagement impact. Preserve the author's voice, tone, and intent. Keep the EXACT same number of tweets (${content.tweets.length}) in the SAME order. Do NOT include an imagePrompt.`;
    } else {
        instruction = `Keep these tweets EXACTLY as-is (do not change any text). Generate an imagePrompt that captures the theme of the content.`;
    }

    const systemPrompt = `You are refining a personal social media post — this is someone's own voice, not a company brand. Your job is to POLISH, not rewrite. The author chose to write manually — respect their voice and personality.

Before refining, think through multiple expert perspectives and synthesize their insights:

FOR THE TWEETS, consider:
- Think from the perspective of a Tech Influencer — what hook would make people stop mid-scroll? What pattern or format gets engagement right now?
- Think from the perspective of a Copywriter — every character counts in 280 chars. What word choices create maximum impact? Where does punch beat explanation?
- Think from the perspective of a Growth Marketer — what makes someone hit retweet? What creates FOMO or curiosity? What framing makes this feel like a must-read?
- Think from the perspective of a Community Manager — what tone feels authentic and personal? What avoids feeling like corporate marketing? What sparks genuine conversation?
- Think from the perspective of a Storyteller — what narrative can you draw from the author's words? Every personal post has a perspective worth amplifying.

Then apply these insights as LIGHT POLISH — fix grammar, sharpen phrasing, boost clarity. Do NOT dramatically rewrite or change the author's meaning.
${options.generateImagePrompt ? `
FOR THE IMAGE — you are a professional visual prompt engineer. Your job is to create image prompts at the quality level of a senior art director at a top creative agency. Follow these principles:

SPECIFICITY IS EVERYTHING. Never use generic descriptions. Every detail must be precise and evocative:
- BAD: "dark background" → GOOD: "2 AM urban darkness, orange sodium streetlight casting harsh directional shadows, light fog diffusing distant signals"
- BAD: "blue colors" → GOOD: "deep Prussian blue transitioning to cerulean at the edges, accented with oxidized copper green"
- BAD: "tech aesthetic" → GOOD: "mixed-media collage combining vintage botanical illustration with precise architectural blueprints"
- BAD: "modern style" → GOOD: "editorial illustration inspired by Bauhaus poster design — bold geometry, limited palette, asymmetric balance"

BREAK OUT OF THE CYBER DEFAULT. Do NOT default to neon, circuit boards, holographic, or cyberpunk aesthetics. Instead, think across the full spectrum of visual art:
- Oil painting, watercolor, gouache, ink wash
- Analog photography (Kodak Portra 400 warmth, Fuji Velvia 50 saturation, Ilford HP5 grain)
- Editorial illustration, vintage poster design, Bauhaus, Art Deco, Art Nouveau
- Macro photography, architectural photography, aerial photography
- Mixed media collage, papercut art, woodblock print, linocut
- Sculptural/physical metaphors: ceramics, metalwork, glass-blowing, origami
Choose the medium that BEST serves the metaphor for THIS specific post's theme.

USE PROFESSIONAL VISUAL VOCABULARY in every field:
- Lighting: Rembrandt lighting, butterfly lighting, split lighting, rim/backlight, golden hour, blue hour, chiaroscuro, high-key, low-key
- Camera: 35mm f/1.4 shallow depth, 85mm portrait compression, 24mm wide environmental, tilt-shift miniature effect
- Color: specify temperature (warm 3000K, cool 7000K), name exact shades (burnt sienna, chartreuse, cerulean, raw umber)
- Composition: rule of thirds, golden ratio spiral, centered symmetry, leading lines, negative space, figure-ground contrast

THINK IN VISUAL METAPHORS — find the perfect concrete metaphor for the author's message. Do NOT reuse canned examples. Create a UNIQUE metaphor specific to the actual content.

QUALITY CHECKLIST — verify before output:
✓ No generic terms (no "modern", "sleek", "tech", "digital" without specific context)
✓ Colors named with precision (not "blue" but "cobalt", "navy", "cerulean")
✓ Lighting technique specified by name
✓ Medium chosen for artistic merit, not defaulted
✓ Visual metaphor is SPECIFIC to this post, not reusable for any post
✓ Mood/atmosphere described with sensory detail
` : ''}
RULES:
- Each tweet MUST be ≤ 280 characters
- You MUST return EXACTLY ${content.tweets.length} tweet(s) in the same order
- Preserve the author's personality, word choices, and intent
- Only fix grammar issues, awkward phrasing, and improve clarity
- Include relevant emojis — they increase engagement
- Do NOT add hashtags unless the author used them
- Do NOT dramatically change the tone or meaning
- This is PERSONAL content — keep it feeling like a real person, not a brand
${options.generateImagePrompt ? '- The imagePrompt MUST be a structured JSON object' : '- Do NOT include an imagePrompt field'}

Respond ONLY with valid JSON:
{
  "format": "${content.format}",
  "tweets": [{ "text": "...", "index": 0 }, ...]${options.generateImagePrompt ? `,
  "imagePrompt": {
    "concept": {
      "main_subject": "The ONE specific visual metaphor for this post — concrete, vivid, not abstract",
      "symbolic_elements": "Supporting visual details that reinforce the metaphor with sensory richness",
      "mood": "The emotional atmosphere — described with feeling, not adjectives (e.g., 'the stillness right before a thunderstorm breaks')"
    },
    "composition": {
      "style": "Specific art movement or technique — e.g., 'Kodak Portra 400 analog photography with lifted shadows and warm cast' or 'gouache illustration with visible brushstrokes in the style of mid-century scientific diagrams'",
      "perspective": "Camera angle with technical precision — e.g., 'low-angle 24mm wide lens creating dramatic convergence' or 'overhead flat-lay at exactly 90 degrees'",
      "focal_point": "What the eye lands on first and what leads it through the composition"
    },
    "environment": {
      "setting": "A fully realized world — not 'abstract space' but a specific place with texture, atmosphere, and story",
      "lighting": "Named lighting technique with color temperature — e.g., 'Rembrandt lighting with warm 3200K key, cool 6500K fill from window'",
      "color_palette": "3-4 precisely named colors with their emotional role — e.g., 'burnt sienna (warmth, craft), ivory (space, breath), deep forest green (growth, stability)'"
    },
    "technical": {
      "medium": "The specific artistic medium chosen for its qualities — e.g., 'wet-plate collodion photography' or 'Japanese woodblock print (ukiyo-e)' or 'mixed media combining ink drawing with watercolor washes'",
      "quality": "The rendering intention — e.g., 'hand-crafted feel with visible material texture' or 'hyper-detailed photorealistic with shallow depth of field'",
      "negative": "Avoid generic stock-photo aesthetics"
    }
  }` : ''}
}`;

    const userPrompt = `${instruction}

${tweetsText}`;

    const responseText = await callGeminiText(env, systemPrompt, userPrompt);
    const result = parseContentResponse(responseText).content;

    // Ensure tweet count matches
    if (result.tweets.length !== content.tweets.length) {
        logError('AI refinement returned wrong tweet count:', result.tweets.length, 'expected:', content.tweets.length);
        // Fall back to original content but keep imagePrompt if generated
        return {
            ...content,
            imagePrompt: result.imagePrompt || content.imagePrompt,
        };
    }

    // Strip imagePrompt if not requested
    if (!options.generateImagePrompt) {
        delete result.imagePrompt;
    }

    return result;
}

/**
 * Build the prompt for content generation
 * SECURITY: Sanitizes input content to prevent prompt injection and excessive size
 * Sends ONLY commit messages and file names — no title, body, author, or stats
 */
function buildContentPrompt(source: ContentSource, overview?: RepoOverview | null): string {
    const { data } = source;

    // Sanitize commit messages
    const safeCommitMessages = data.commitMessages
        .map(msg => sanitizeContent(msg, 200))
        .join('\n- ');

    // Sanitize file names
    const safeFileNames = data.fileNames
        .map(f => sanitizeContent(f, 200))
        .join('\n- ');

    const isSimple = data.fileNames.length <= 3;

    // Build overview section if available
    let overviewSection = '';
    if (overview) {
        const parts: string[] = ['## PROJECT OVERVIEW'];
        if (overview.summary) parts.push(`**Summary:** ${overview.summary}`);
        if (overview.tech_stack) parts.push(`**Tech Stack:** ${overview.tech_stack}`);
        if (overview.key_features.length > 0) parts.push(`**Key Features:** ${overview.key_features.join(', ')}`);
        if (overview.target_audience) parts.push(`**Target Audience:** ${overview.target_audience}`);
        if (overview.brand_voice) parts.push(`**Brand Voice:** ${overview.brand_voice}`);
        if (overview.visual_theme) parts.push(`**Visual Theme:** ${overview.visual_theme}`);
        if (overview.recent_changes.length > 0) parts.push(`**Recent Changes:** ${overview.recent_changes.slice(-5).join('; ')}`);
        overviewSection = parts.join('\n') + '\n\n';
    }

    return `${overviewSection}Create a social media package for this code change.

**Commits:**
- ${safeCommitMessages || 'No commit messages available'}

**Changed Files:**
- ${safeFileNames || 'No file names available'}

${isSimple
        ? 'This is a focused change — create a single impactful tweet.'
        : 'This is a substantial change — create a thread (2-5 tweets). First tweet hooks, rest adds depth.'}

Remember: Valid JSON only. Each tweet ≤ 280 chars. imagePrompt must be a structured JSON object.`;
}

// ==================== VIDEO SCRIPT GENERATION ====================

/**
 * Length setting → target word count and scene count
 */
const LENGTH_CALIBRATION: Record<string, { words: number; minScenes: number; maxScenes: number }> = {
    '30s': { words: 70, minScenes: 1, maxScenes: 1 },
    '60s': { words: 160, minScenes: 1, maxScenes: 2 },
    '90s': { words: 240, minScenes: 2, maxScenes: 3 },
    '2m': { words: 320, minScenes: 2, maxScenes: 4 },
    '3m': { words: 480, minScenes: 3, maxScenes: 6 },
    '5m': { words: 800, minScenes: 5, maxScenes: 10 },
};

const VIDEO_SCRIPT_SYSTEM_PROMPT = `You are a professional video script writer for short-form social media videos featuring an AI avatar presenter.

Your job is to write engaging, natural-sounding scripts for a developer/tech persona who presents code updates, feature announcements, and project news to their audience.

The video will be rendered by an AI avatar (HeyGen Avatar IV with full body movement), so the script must sound natural when spoken aloud. Write conversationally — like a YouTuber or tech influencer talking to their audience, not like a blog post read aloud.

SCRIPT STRUCTURE:
- Each video has one or more SCENES. Each scene is a continuous segment with its own emotion, motion prompt, and optional text overlay.
- Scenes should flow naturally with transitions ("Now let me show you...", "But here's the exciting part...", "And finally...").
- The first scene should HOOK the viewer immediately — start with the most interesting/impactful point.
- The last scene should have a clear wrap-up or call-to-action.

PER-SCENE GUIDELINES:
- Each scene targets 50-120 words of spoken text.
- Choose an emotion per scene that matches the content (Excited for launches, Serious for security fixes, Friendly for general updates, etc.).
- Text overlays should be SHORT key phrases (5-10 words max) that reinforce the spoken content — like chapter titles or key stats.

MOTION PROMPT GUIDELINES:
Each scene MUST include a motionPrompt describing the avatar's body movement, hand gestures, and facial expressions.
- Format: "[Subject] + [Action] + [Emotion/intensity]" — 1-2 short clauses
- Use strong action verbs: gesture, lean, nod, point, wave, smile, raise, tilt, shrug, count on fingers
- Describe concrete physical actions, NOT abstract emotions
- Avoid negative phrasing ("don't move arms") — describe what to DO
- Match the motion to the scene content and emotion

Good examples:
- Excited Launch: "Avatar raises both hands excitedly, beaming with enthusiasm"
- Technical Deep Dive: "Avatar leans forward thoughtfully, counting points on fingers"
- Casual Update: "Avatar shrugs casually with a relaxed smile"
- Professional: "Avatar nods confidently while making an open palm gesture"
- Wrap-up: "Avatar tilts head and gestures with right hand while explaining"

TONE ADAPTATION:
- "Casual Update": Relaxed, conversational, like chatting with a friend about what you built
- "Professional Announcement": Confident, clear, structured — suitable for company channels
- "Technical Deep Dive": Detailed, precise, educational — walks through the "how" and "why"
- "Excited Launch": High energy, celebratory — this is a big deal and you want people to know
- "Community Chat": Warm, inclusive, appreciative — acknowledging contributors and community

CAPTION GUIDELINES:
- Instagram caption: Up to 2200 chars. Include context, key points, and 3-5 relevant hashtags. Written for discoverability.
- Twitter caption: Max 280 chars. Concise standalone hook that makes people want to watch. No hashtags unless they fit naturally.

Respond ONLY with valid JSON matching this structure:
{
  "title": "Short descriptive title for the video",
  "scenes": [
    {
      "scriptText": "The spoken text for this scene segment",
      "emotion": "Excited|Friendly|Serious|Soothing|Broadcaster",
      "motionPrompt": "Avatar gestures enthusiastically while leaning forward",
      "textOverlay": "Optional short key phrase shown on screen"
    }
  ],
  "caption": "Instagram caption (max 2200 chars with hashtags)",
  "twitterCaption": "Twitter caption (max 280 chars)",
  "totalWordCount": 123
}`;

interface VideoScriptOptions {
    overview?: RepoOverview | null;
    commitMessages?: string[];
    fileNames?: string[];
    tone: string;
    length: string;
    manualInstructions?: string;
    characterPersonality?: string;
    emotion: string;
    textOverlayEnabled: boolean;
}

/**
 * Generate a multi-scene video script via Gemini
 */
export async function generateVideoScript(
    env: Env,
    options: VideoScriptOptions
): Promise<VideoScriptResponse> {
    const calibration = LENGTH_CALIBRATION[options.length] || LENGTH_CALIBRATION['60s'];

    const promptParts: string[] = [];

    // Project context
    if (options.overview) {
        const ov = options.overview;
        promptParts.push('## PROJECT CONTEXT');
        if (ov.summary) promptParts.push(`**Project:** ${ov.summary}`);
        if (ov.tech_stack) promptParts.push(`**Tech Stack:** ${ov.tech_stack}`);
        if (ov.key_features.length > 0) promptParts.push(`**Key Features:** ${ov.key_features.join(', ')}`);
        if (ov.target_audience) promptParts.push(`**Target Audience:** ${ov.target_audience}`);
        if (ov.brand_voice) promptParts.push(`**Brand Voice:** ${ov.brand_voice}`);
        promptParts.push('');
    }

    // Commit data
    if (options.commitMessages && options.commitMessages.length > 0) {
        promptParts.push('## RECENT CHANGES');
        promptParts.push('**Commits:**');
        for (const msg of options.commitMessages.slice(0, 20)) {
            promptParts.push(`- ${sanitizeContent(msg, 200)}`);
        }
        if (options.fileNames && options.fileNames.length > 0) {
            promptParts.push('**Changed Files:**');
            for (const f of options.fileNames.slice(0, 30)) {
                promptParts.push(`- ${sanitizeContent(f, 200)}`);
            }
        }
        promptParts.push('');
    }

    // Configuration
    promptParts.push('## VIDEO CONFIGURATION');
    promptParts.push(`**Tone:** ${options.tone}`);
    promptParts.push(`**Target Length:** ${options.length} (~${calibration.words} words)`);
    promptParts.push(`**Scene Count:** ${calibration.minScenes}-${calibration.maxScenes} scenes`);
    promptParts.push(`**Default Emotion:** ${options.emotion}`);
    promptParts.push(`**Text Overlays:** ${options.textOverlayEnabled ? 'Include short key phrases per scene' : 'Do NOT include text overlays'}`);
    if (options.characterPersonality) {
        promptParts.push(`**Presenter Personality:** ${options.characterPersonality}`);
    }
    promptParts.push('');

    // Manual instructions
    if (options.manualInstructions) {
        promptParts.push('## ADDITIONAL INSTRUCTIONS');
        promptParts.push(options.manualInstructions);
        promptParts.push('');
    }

    promptParts.push(`Write a video script with ${calibration.minScenes}-${calibration.maxScenes} scenes, targeting ~${calibration.words} total spoken words. Each scene should have 50-120 words.`);
    promptParts.push('Respond with valid JSON only.');

    const userPrompt = promptParts.join('\n');
    const responseText = await callGeminiText(env, VIDEO_SCRIPT_SYSTEM_PROMPT, userPrompt);

    return parseAndValidateVideoScript(responseText, options, calibration);
}

/**
 * Parse and validate a video script response from Gemini
 */
function parseAndValidateVideoScript(
    responseText: string,
    options: VideoScriptOptions,
    calibration: { words: number; minScenes: number; maxScenes: number }
): VideoScriptResponse {
    // Extract JSON
    let jsonStr = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();
    const braceStart = jsonStr.indexOf('{');
    const braceEnd = jsonStr.lastIndexOf('}');
    if (braceStart !== -1 && braceEnd > braceStart) {
        jsonStr = jsonStr.substring(braceStart, braceEnd + 1);
    }

    let parsed: any;
    try {
        parsed = JSON.parse(jsonStr);
    } catch {
        logError('Failed to parse video script JSON');
        throw new Error('Failed to parse video script response');
    }

    // Validate scenes
    if (!Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
        throw new Error('Video script has no scenes');
    }

    const validEmotions = ['Excited', 'Friendly', 'Serious', 'Soothing', 'Broadcaster'];
    const defaultEmotion = (options.emotion || 'Friendly') as HeyGenEmotion;

    const scenes: VideoScene[] = parsed.scenes.map((scene: any) => ({
        scriptText: String(scene.scriptText || ''),
        emotion: validEmotions.includes(scene.emotion) ? scene.emotion : defaultEmotion,
        motionPrompt: String(scene.motionPrompt || 'Avatar speaks naturally with subtle gestures'),
        textOverlay: options.textOverlayEnabled ? (scene.textOverlay || undefined) : undefined,
    }));

    // Validate non-empty scriptText
    for (const scene of scenes) {
        if (!scene.scriptText.trim()) {
            throw new Error('Video script contains empty scene');
        }
    }

    // Calculate word count
    const totalWordCount = scenes.reduce((sum, s) => sum + s.scriptText.split(/\s+/).length, 0);

    // Warn if word count deviates >30% from target
    const deviation = Math.abs(totalWordCount - calibration.words) / calibration.words;
    if (deviation > 0.3) {
        logInfo(`Video script word count deviation: ${totalWordCount} words vs ${calibration.words} target (${Math.round(deviation * 100)}%)`);
    }

    // Validate captions
    let caption = String(parsed.caption || '');
    if (caption.length > 2200) caption = caption.substring(0, 2200);

    let twitterCaption = String(parsed.twitterCaption || '');
    if (twitterCaption.length > 280) twitterCaption = twitterCaption.substring(0, 280);

    return {
        title: String(parsed.title || 'Untitled Video'),
        scenes,
        caption,
        twitterCaption,
        totalWordCount,
    };
}
