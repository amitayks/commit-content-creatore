/**
 * Repost Content Generation Prompt — For generating quote tweets
 *
 * Dedicated system prompt for creating engaging quote tweets (reposts)
 * with persona and history context. Used by the content-bot for on-demand generation.
 */

export const REPOST_SYSTEM_PROMPT = `You are creating a quote tweet (repost) response to someone else's tweet.

Your goal is to create content that:
1. Adds genuine value beyond the original tweet
2. Positions the poster as a knowledgeable voice in the space
3. Encourages engagement (replies, retweets)
4. Feels authentic and not like automated content

APPROACH — Think through these perspectives:
- Tech Influencer: What angle makes this worth reading? What insight can you add?
- Community Builder: How does this start a conversation? What makes people reply?
- Growth Strategist: How does this build the poster's reputation and following?
- Domain Expert: What context, nuance, or counterpoint can you provide?

TONE GUIDELINES:
- professional: Insightful, authoritative. Think industry thought leader.
- casual: Relaxed, conversational. Like chatting with a smart friend.
- analytical: Data-driven, precise. Break things down and explain.
- enthusiastic: Energetic, excited. Celebrate wins and progress.
- witty: Clever wordplay, smart humor. Make people smile and think.
- sarcastic: Sharp, incisive Twitter-style humor. Make strong points with wit and a respectful edge. Use irony effectively. Never mean-spirited or personal — punch up, not down. Think "clever observation that makes people go 'damn, that's true'" not "attacking someone." Wrap genuine insights in cleverness.

RULES:
- Each tweet MUST be ≤ 280 characters
- DO NOT just summarize the original tweet — add a NEW perspective
- Include emojis where natural
- Match the specified tone CLOSELY — especially for sarcastic, lean into the wit
- Consider: agreeing and expanding, offering a different angle, adding context, asking a thought-provoking question

Respond ONLY with valid JSON in this exact format:
{
  "format": "single",
  "tweets": [{ "text": "...", "index": 0 }],
  "imagePrompt": null
}

NOTE: For reposts, we typically generate a single tweet (not a thread).
Only use thread format if the original content genuinely warrants a multi-part response.`;

/**
 * Build the user prompt for repost content generation
 */
export function buildRepostUserPrompt(params: {
    originalTweet: string;
    authorUsername: string;
    isThread: boolean;
    tone: string;
    language: string;
    includeHashtags: boolean;
    persona?: string | null;
    recentTweets?: string[];
    hasImage?: boolean;
}): string {
    const parts: string[] = [];

    parts.push(`ORIGINAL TWEET by @${params.authorUsername}${params.isThread ? ' (Thread)' : ''}:`);
    parts.push(params.originalTweet);
    parts.push('');

    parts.push(`SETTINGS:`);
    parts.push(`- Tone: ${params.tone}`);
    parts.push(`- Language: ${params.language === 'he' ? 'Hebrew' : 'English'}`);
    parts.push(`- Include hashtags: ${params.includeHashtags ? 'Yes' : 'No'}`);
    parts.push('');

    if (params.persona) {
        parts.push(`PERSONA CONTEXT (about @${params.authorUsername}):`);
        parts.push(params.persona);
        parts.push('');
    }

    if (params.recentTweets && params.recentTweets.length > 0) {
        parts.push(`RECENT TWEETS BY POSTER (for voice/style reference, last ${params.recentTweets.length}):`);
        for (const tweet of params.recentTweets.slice(0, 10)) {
            parts.push(`- ${tweet.substring(0, 100)}`);
        }
        parts.push('');
    }

    if (params.hasImage) {
        parts.push('NOTE: The original tweet includes an attached image (shown above). Consider the image content when crafting your response — reference what you see if relevant.');
        parts.push('');
    }

    parts.push('Generate a quote tweet response that adds genuine value.');

    return parts.join('\n');
}
