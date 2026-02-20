/**
 * Persona Bootstrap Service — Generates account overview using Gemini with web search
 *
 * Fetches profile info, recent tweets, then calls Gemini to build a persona overview
 * that will be used as context for all future repost generation.
 */

import type { Env } from '../types';
import { getTwitterAccount, getRecentTweetsByAccount, upsertTwitterAccountOverview } from './db';
import { PERSONA_SYSTEM_PROMPT, buildPersonaUserPrompt } from './persona-prompt';

const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_MODEL = 'gemini-2.0-flash';

interface PersonaResult {
    persona: string;
    topics: string[];
    communication_style: string;
    notable_context: string;
    recent_themes: string[];
}

/**
 * Bootstrap persona overview for a Twitter account
 */
export async function bootstrapPersona(env: Env, accountId: string, chatId: string): Promise<boolean> {
    const account = await getTwitterAccount(env, accountId, chatId);
    if (!account) {
        console.error(`[persona] Account ${accountId} not found`);
        return false;
    }

    // Get recent tweets for context
    const recentTweets = await getRecentTweetsByAccount(env, chatId, accountId, 30);

    const userPrompt = buildPersonaUserPrompt({
        username: account.username,
        displayName: account.display_name,
        recentTweets: recentTweets.map(t => t.text),
    });

    try {
        const url = `${GEMINI_API}/models/${GEMINI_MODEL}:generateContent?key=${env.GOOGLE_API_KEY}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    { role: 'user', parts: [{ text: userPrompt }] },
                ],
                systemInstruction: {
                    parts: [{ text: PERSONA_SYSTEM_PROMPT }],
                },
                generationConfig: {
                    temperature: 0.5,
                },
                tools: [{
                    googleSearch: {},
                }],
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('[persona] Gemini API error:', response.status, error);
            return false;
        }

        const data = await response.json() as {
            candidates?: Array<{
                content?: { parts?: Array<{ text?: string }> };
            }>;
        };

        // With googleSearch enabled, response may have multiple parts (text + search grounding)
        // Find the first text part and extract JSON from it
        const parts = data.candidates?.[0]?.content?.parts || [];
        const textPart = parts.find(p => p.text)?.text;
        if (!textPart) {
            console.error('[persona] No response text from Gemini');
            return false;
        }

        // Extract JSON from freeform response (may be wrapped in ```json blocks)
        const jsonMatch = textPart.match(/```json\s*([\s\S]*?)```/) || textPart.match(/(\{[\s\S]*\})/);
        if (!jsonMatch) {
            console.error('[persona] Could not extract JSON from Gemini response:', textPart.substring(0, 200));
            return false;
        }

        const result = JSON.parse(jsonMatch[1]) as PersonaResult;

        // Store the persona overview
        await upsertTwitterAccountOverview(env, accountId, {
            persona: result.persona,
            topics: JSON.stringify(result.topics),
            communication_style: result.communication_style,
            notable_context: result.notable_context,
            recent_themes: JSON.stringify(result.recent_themes),
        });

        console.log(`[persona] Bootstrapped persona for @${account.username}`);
        return true;
    } catch (error) {
        console.error('[persona] Bootstrap failed:', error);
        return false;
    }
}
