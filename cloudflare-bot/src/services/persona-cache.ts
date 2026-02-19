/**
 * Persona Cache Service — Lightweight persona for non-followed accounts
 *
 * Checks persona_cache → if fresh (<30 days) return cached →
 * otherwise fetch profile via X API + Gemini web search → upsert cache.
 */

import type { Env, PersonaCache } from '../types';
import { getPersonaCache, upsertPersonaCache } from './db';
import { lookupUserByUsername } from './x';
import { PERSONA_SYSTEM_PROMPT, buildPersonaUserPrompt } from './persona-prompt';

const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_MODEL = 'gemini-2.0-flash';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface CachedPersona {
    persona: string;
    topics: string | null;
    displayName: string | null;
    bio: string | null;
}

/**
 * Get or create a persona for any username.
 * Uses persona_cache with 30-day TTL.
 */
export async function getOrCreatePersona(
    env: Env,
    username: string,
    userId?: string,
    profileBio?: string,
    displayName?: string
): Promise<CachedPersona | null> {
    const cached = await getPersonaCache(env, username);

    // Check if cache is fresh
    if (cached?.persona) {
        const age = Date.now() - new Date(cached.updated_at).getTime();
        if (age < CACHE_TTL_MS) {
            return {
                persona: cached.persona,
                topics: cached.topics,
                displayName: cached.display_name,
                bio: cached.bio,
            };
        }
    }

    // Cache miss or stale — generate fresh persona
    let bio = profileBio;
    let name = displayName;
    let uid = userId;

    // If we don't have profile info, fetch it
    if (!bio && !name) {
        try {
            const user = await lookupUserByUsername(env, username);
            if (user) {
                uid = user.id;
                name = user.name;
            }
        } catch (error) {
            console.error(`[persona-cache] Profile lookup failed for @${username}:`, error);
        }
    }

    // Call Gemini with web search grounding
    try {
        const userPrompt = buildPersonaUserPrompt({
            username,
            displayName: name,
            bio,
        });

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
                    responseMimeType: 'application/json',
                    temperature: 0.5,
                },
                tools: [{
                    googleSearch: {},
                }],
            }),
        });

        if (!response.ok) {
            console.error('[persona-cache] Gemini error:', response.status);
            return null;
        }

        const data = await response.json() as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return null;

        const result = JSON.parse(text) as {
            persona: string;
            topics?: string[];
            communication_style?: string;
            notable_context?: string;
        };

        // Store in cache
        await upsertPersonaCache(env, username, {
            user_id: uid,
            display_name: name,
            bio: bio || undefined,
            persona: result.persona,
            topics: result.topics ? JSON.stringify(result.topics) : undefined,
        });

        console.log(`[persona-cache] Generated and cached persona for @${username}`);

        return {
            persona: result.persona,
            topics: result.topics ? JSON.stringify(result.topics) : null,
            displayName: name || null,
            bio: bio || null,
        };
    } catch (error) {
        console.error('[persona-cache] Generation failed:', error);
        return null;
    }
}
