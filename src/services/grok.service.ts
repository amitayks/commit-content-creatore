/**
 * Grok AI service for content generation.
 */

import { AI_CONFIG, API_KEYS, CONTENT_CONFIG } from '../constants.js';
import type { ContentFormat, ContentGenerationContext, Tweet } from '../types/index.js';
import logger from '../utils/logger.js';
import { defaultApiRetryCondition, retryWithBackoff } from '../utils/retry.js';

/** AI-generated thread response */
export interface GeneratedContent {
  format: ContentFormat;
  tweets: Tweet[];
  reasoning?: string;
}

/** Grok API message format */
interface GrokMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Grok AI service for content generation.
 */
export class GrokService {
  private apiKey: string;
  private model: string;
  private baseUrl = 'https://api.x.ai/v1';

  constructor() {
    this.apiKey = API_KEYS.GROK_API_KEY;
    this.model = AI_CONFIG.GROK_MODEL;
  }

  /**
   * Make a request to the Grok API.
   */
  private async chat(
    messages: GrokMessage[],
    maxTokens: number = AI_CONFIG.MAX_TOKENS
  ): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        max_tokens: maxTokens,
        temperature: AI_CONFIG.TEMPERATURE,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Grok API error ${response.status}: ${error}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    return data.choices[0]?.message?.content || '';
  }

  /**
   * Build the system prompt for thread generation.
   */
  private buildSystemPrompt(config: {
    tone: string;
    contentTypes: string[];
    emojis: boolean;
    hashtags: string[];
  }): string {
    return `You are an expert developer content creator who transforms code changes into engaging X (Twitter) threads.

Your writing style:
- Tone: ${config.tone}
- Focus on: ${config.contentTypes.join(', ')}
- ${config.emojis ? 'Use emojis naturally to add personality' : 'Do not use emojis'}

Rules:
1. Each tweet MUST be under 280 characters
2. Make content feel natural and human, not robotic
3. Share genuine insights, learnings, or excitement about the code
4. Include code snippets only when they add value (keep them very short)
5. End threads with a call to action or thought-provoking question
6. Include these hashtags in the final tweet: ${config.hashtags.join(' ')}

You must respond with valid JSON in this exact format:
{
  "format": "single" | "thread",
  "reasoning": "Brief explanation of your format choice",
  "tweets": [
    { "text": "Tweet content here (max 280 chars)" },
    { "text": "Next tweet if thread..." }
  ]
}`;
  }

  /**
   * Build the user prompt with context.
   */
  private buildUserPrompt(context: ContentGenerationContext): string {
    let prompt = `Create engaging X content for this code change:

**Repository**: ${context.repository.fullName}
**Language**: ${context.repository.language}
**Event**: ${context.eventType === 'pr' ? 'Pull Request Merged' : 'Code Push'}
`;

    if (context.pullRequest) {
      prompt += `
**PR Title**: ${context.pullRequest.title}
**PR Description**: ${context.pullRequest.body || 'No description'}
**Author**: ${context.pullRequest.author}
`;
    }

    prompt += `
**Commits** (${context.commits.length}):
${context.commits
  .slice(0, 10)
  .map((c) => `- ${c.message}`)
  .join('\n')}
`;

    if (context.files.length > 0) {
      prompt += `
**Files Changed** (${context.files.length}):
${context.files
  .slice(0, 15)
  .map((f) => `- ${f.path} (+${f.linesAdded} -${f.linesRemoved})`)
  .join('\n')}
`;
    }

    if (context.diff) {
      // Include a truncated diff for context
      const diffPreview = context.diff.slice(0, 2000);
      prompt += `
**Diff Preview**:
\`\`\`
${diffPreview}${context.diff.length > 2000 ? '\n... (truncated)' : ''}
\`\`\`
`;
    }

    prompt += `
**Source**: ${context.sourceUrl}

Based on this context, create ${context.commits.length >= 3 ? 'a thread (multiple tweets)' : 'content (single tweet or thread based on significance)'} that would interest developers.`;

    return prompt;
  }

  /**
   * Generate content for a GitHub event.
   */
  async generateContent(
    context: ContentGenerationContext,
    options: {
      tone?: string;
      contentTypes?: string[];
      emojis?: boolean;
      hashtags?: string[];
    } = {}
  ): Promise<GeneratedContent> {
    const {
      tone = 'professional-casual',
      contentTypes = ['technical', 'feature'],
      emojis = true,
      hashtags = ['#DevLife', '#Coding'],
    } = options;

    return retryWithBackoff(
      async () => {
        const systemPrompt = this.buildSystemPrompt({ tone, contentTypes, emojis, hashtags });
        const userPrompt = this.buildUserPrompt(context);

        logger.info('Generating content with Grok', {
          projectId: context.projectId,
          eventType: context.eventType,
          commitCount: context.commits.length,
        });

        const response = await this.chat([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ]);

        return this.parseResponse(response);
      },
      {
        shouldRetry: defaultApiRetryCondition,
        context: 'generateContent',
        maxRetries: 2,
      }
    );
  }

  /**
   * Parse the AI response into structured content.
   */
  private parseResponse(response: string): GeneratedContent {
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = response.match(/```json\s*\n?([\s\S]*?)\n?```/) ||
        response.match(/```\s*\n?([\s\S]*?)\n?```/) || [null, response];

      const jsonStr = jsonMatch[1] || response;
      const parsed = JSON.parse(jsonStr.trim()) as GeneratedContent;

      // Validate and fix tweet lengths
      const tweets = parsed.tweets.map((tweet) => {
        let text = tweet.text;
        if (text.length > CONTENT_CONFIG.MAX_TWEET_LENGTH) {
          logger.warn(`Tweet exceeds max length, truncating`, {
            original: text.length,
            max: CONTENT_CONFIG.MAX_TWEET_LENGTH,
          });
          text = text.slice(0, CONTENT_CONFIG.MAX_TWEET_LENGTH - 3) + '...';
        }
        return { text, mediaPath: tweet.mediaPath };
      });

      return {
        format: parsed.format || (tweets.length > 1 ? 'thread' : 'single'),
        tweets,
        reasoning: parsed.reasoning,
      };
    } catch (error) {
      logger.error('Failed to parse AI response', { error, response: response.slice(0, 500) });

      // Fallback: treat entire response as a single tweet
      return {
        format: 'single',
        tweets: [{ text: response.slice(0, CONTENT_CONFIG.MAX_TWEET_LENGTH) }],
      };
    }
  }

  /**
   * Regenerate content with additional instructions.
   */
  async regenerateContent(
    context: ContentGenerationContext,
    previousContent: GeneratedContent,
    feedback?: string
  ): Promise<GeneratedContent> {
    const userPrompt =
      this.buildUserPrompt(context) +
      `

**Previous Generation**:
${previousContent.tweets.map((t, i) => `${i + 1}. ${t.text}`).join('\n')}

**Feedback**: ${feedback || 'Please regenerate with a fresh perspective, making it more engaging and natural.'}

Generate improved content based on this feedback.`;

    return retryWithBackoff(
      async () => {
        const response = await this.chat([
          {
            role: 'system',
            content: this.buildSystemPrompt({
              tone: 'professional-casual',
              contentTypes: ['technical', 'feature'],
              emojis: true,
              hashtags: ['#DevLife', '#Coding'],
            }),
          },
          { role: 'user', content: userPrompt },
        ]);

        return this.parseResponse(response);
      },
      { shouldRetry: defaultApiRetryCondition, context: 'regenerateContent' }
    );
  }

  /**
   * Check if the Grok API is available.
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.chat([{ role: 'user', content: 'Hi' }], 10);
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const grokService = new GrokService();
