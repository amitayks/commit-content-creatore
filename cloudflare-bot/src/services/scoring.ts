/**
 * AI Scoring Service — Batch tweet relevance scoring via Gemini
 */

import type { Env, TwitterTweet } from '../types';
import { updateTwitterTweet } from './db';
import { SCORING_SYSTEM_PROMPT, buildScoringUserPrompt } from './scoring-prompt';

const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_MODEL = 'gemini-2.0-flash';

interface ScoringResult {
    scores: Array<{
        tweet_id: string;
        score: number;
        reason: string;
    }>;
}

/**
 * Score a batch of tweets for relevance using Gemini
 */
export async function scoreTweetBatch(env: Env, tweets: TwitterTweet[]): Promise<void> {
    if (tweets.length === 0) return;

    // Only score pending tweets
    const pendingTweets = tweets.filter(t => t.status === 'pending');
    if (pendingTweets.length === 0) return;

    console.log(`[scoring] Scoring ${pendingTweets.length} tweets`);

    const userPrompt = buildScoringUserPrompt(pendingTweets);

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
                    parts: [{ text: SCORING_SYSTEM_PROMPT }],
                },
                generationConfig: {
                    responseMimeType: 'application/json',
                    temperature: 0.3,
                },
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('[scoring] Gemini API error:', response.status, error);
            return;
        }

        const data = await response.json() as {
            candidates?: Array<{
                content?: { parts?: Array<{ text?: string }> };
            }>;
        };

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
            console.error('[scoring] No response text from Gemini');
            return;
        }

        const result = JSON.parse(text) as ScoringResult;

        // Update each tweet with its score
        for (const score of result.scores) {
            const tweet = pendingTweets.find(t => t.id === score.tweet_id);
            if (!tweet) continue;

            await updateTwitterTweet(env, score.tweet_id, {
                relevance_score: score.score,
                relevance_reason: score.reason,
                status: 'scored',
            });
        }

        console.log(`[scoring] Scored ${result.scores.length} tweets`);
    } catch (error) {
        console.error('[scoring] Failed to score tweets:', error);
    }
}
