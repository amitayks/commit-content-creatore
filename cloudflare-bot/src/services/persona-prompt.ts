/**
 * Persona Bootstrap Prompt — For generating account persona overviews
 *
 * Uses Gemini with web search grounding to research a Twitter account
 * and generate a comprehensive persona overview.
 */

export const PERSONA_SYSTEM_PROMPT = `You are researching a Twitter/X account to build a persona overview for content generation.

Given the account's username and any available profile information, research this person/company and create a comprehensive persona that will help generate relevant, contextual quote tweets about their posts.

RESEARCH FOCUS:
1. Who they are — role, company, expertise area
2. What they tweet about — main topics, recurring themes
3. How they communicate — tone, style, formality level
4. Notable context — recent projects, achievements, controversies
5. Their audience — who follows and engages with them

OUTPUT FORMAT — Respond ONLY with valid JSON:
{
  "persona": "2-3 sentence overview of who this person/company is and what they're known for",
  "topics": ["topic1", "topic2", "topic3", "topic4", "topic5"],
  "communication_style": "Brief description of their communication style and tone",
  "notable_context": "Recent notable projects, achievements, or context that may be relevant",
  "recent_themes": ["theme1", "theme2", "theme3"]
}

GUIDELINES:
- Be specific, not generic. "Senior engineer at Vercel focused on React Server Components" is better than "tech person"
- Topics should be their TOP 5 most-tweeted-about subjects
- Communication style should note formality level, humor usage, emoji usage, etc.
- Recent themes should capture what they've been talking about in the last few weeks/months
- If you can't find much info, be honest rather than making things up`;

/**
 * Build the user prompt for persona bootstrap
 */
export function buildPersonaUserPrompt(params: {
    username: string;
    displayName?: string | null;
    bio?: string | null;
    recentTweets?: string[];
}): string {
    const parts: string[] = [];

    parts.push(`Research this Twitter/X account and build a persona overview:`);
    parts.push('');
    parts.push(`Username: @${params.username}`);

    if (params.displayName) {
        parts.push(`Display Name: ${params.displayName}`);
    }
    if (params.bio) {
        parts.push(`Bio: ${params.bio}`);
    }

    parts.push('');
    parts.push(`Search the web for information about @${params.username} to build a comprehensive persona.`);

    if (params.recentTweets && params.recentTweets.length > 0) {
        parts.push('');
        parts.push(`RECENT TWEETS (for topic/style analysis):`);
        for (const tweet of params.recentTweets.slice(0, 15)) {
            parts.push(`- ${tweet.substring(0, 150)}`);
        }
    }

    return parts.join('\n');
}
