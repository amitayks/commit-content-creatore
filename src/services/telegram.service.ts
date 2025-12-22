/**
 * Telegram bot service for notifications and interactive review.
 */

import { API_KEYS, RATE_LIMITS } from '../constants.js';
import type { Draft, DraftStatus, DraftSummary } from '../types/index.js';
import logger from '../utils/logger.js';
import { defaultApiRetryCondition, retryWithBackoff } from '../utils/retry.js';

/** Telegram inline keyboard button */
interface InlineButton {
  text: string;
  callback_data: string;
}

/** Telegram API response */
interface TelegramResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

/** Telegram message result */
interface MessageResult {
  message_id: number;
  chat: { id: number };
  date: number;
}

/** Telegram update object */
export interface TelegramUpdate {
  update_id: number;
  callback_query?: {
    id: string;
    from: { id: number; first_name: string };
    message?: { message_id: number; chat: { id: number } };
    data: string;
  };
  message?: {
    message_id: number;
    from: { id: number };
    chat: { id: number };
    text: string;
    reply_to_message?: { message_id: number };
  };
}

/**
 * Telegram bot service.
 */
export class TelegramService {
  private token: string;
  private chatId: string;
  private baseUrl: string;

  constructor() {
    this.token = API_KEYS.TELEGRAM_BOT_TOKEN;
    this.chatId = API_KEYS.TELEGRAM_CHAT_ID;
    this.baseUrl = `https://api.telegram.org/bot${this.token}`;
  }

  /**
   * Make a Telegram API request.
   */
  private async request<T>(method: string, body?: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${this.baseUrl}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = (await response.json()) as TelegramResponse<T>;

    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description}`);
    }

    return data.result as T;
  }

  /**
   * Send a message.
   */
  async sendMessage(
    text: string,
    options: {
      parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
      replyMarkup?: { inline_keyboard: InlineButton[][] };
      replyToMessageId?: number;
    } = {}
  ): Promise<number> {
    return retryWithBackoff(
      async () => {
        const result = await this.request<MessageResult>('sendMessage', {
          chat_id: this.chatId,
          text,
          parse_mode: options.parseMode || 'HTML',
          reply_markup: options.replyMarkup,
          reply_to_message_id: options.replyToMessageId,
        });

        return result.message_id;
      },
      { shouldRetry: defaultApiRetryCondition, context: 'sendMessage' }
    );
  }

  /**
   * Edit a message.
   */
  async editMessage(
    messageId: number,
    text: string,
    options: {
      parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
      replyMarkup?: { inline_keyboard: InlineButton[][] };
    } = {}
  ): Promise<void> {
    await retryWithBackoff(
      async () => {
        await this.request('editMessageText', {
          chat_id: this.chatId,
          message_id: messageId,
          text,
          parse_mode: options.parseMode || 'HTML',
          reply_markup: options.replyMarkup,
        });
      },
      { shouldRetry: defaultApiRetryCondition, context: 'editMessage' }
    );
  }

  /**
   * Answer a callback query (acknowledge button press).
   */
  async answerCallback(callbackId: string, text?: string): Promise<void> {
    await this.request('answerCallbackQuery', {
      callback_query_id: callbackId,
      text,
    });
  }

  /**
   * Format a draft for preview.
   */
  formatDraftPreview(draft: Draft): string {
    const lines: string[] = [
      `📝 <b>New Draft Ready for Review</b>`,
      ``,
      `📦 <b>Project:</b> ${draft.projectId}`,
      `🔗 <a href="${draft.source.url}">View on GitHub</a>`,
      `📊 <b>Format:</b> ${draft.content.format === 'thread' ? `Thread (${draft.content.tweets.length} tweets)` : 'Single Tweet'}`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━`,
    ];

    draft.content.tweets.forEach((tweet, i) => {
      const header =
        draft.content.tweets.length > 1 ? `\n<b>[${i + 1}/${draft.content.tweets.length}]</b>` : '';
      const charCount = `<i>(${tweet.text.length}/280)</i>`;
      lines.push(`${header}`);
      lines.push(`${this.escapeHtml(tweet.text)}`);
      lines.push(`${charCount}`);
    });

    lines.push(`━━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`\n🆔 <code>${draft.id}</code>`);
    lines.push(``);
    lines.push(`<i>✅ Approve → Ready for /publish</i>`);
    lines.push(`<i>🔄 Regenerate → New AI version</i>`);
    lines.push(`<i>✏️ Edit → Reply with "1: new text"</i>`);

    return lines.join('\n');
  }

  /**
   * Escape HTML special characters.
   */
  private escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /**
   * Create inline keyboard for draft actions.
   */
  createDraftKeyboard(draftId: string): { inline_keyboard: InlineButton[][] } {
    return {
      inline_keyboard: [
        [
          { text: '✅ Approve', callback_data: `approve:${draftId}` },
          { text: '❌ Reject', callback_data: `reject:${draftId}` },
        ],
        [
          { text: '🔄 Regenerate', callback_data: `regenerate:${draftId}` },
          { text: '✏️ Edit', callback_data: `edit:${draftId}` },
        ],
      ],
    };
  }

  /**
   * Send a draft notification.
   */
  async notifyNewDraft(draft: Draft): Promise<number> {
    const text = this.formatDraftPreview(draft);
    const keyboard = this.createDraftKeyboard(draft.id);

    const messageId = await this.sendMessage(text, {
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });

    logger.info(`Sent draft notification`, { draftId: draft.id, messageId });
    return messageId;
  }

  /**
   * Update draft message after an action.
   */
  async updateDraftMessage(draft: Draft, action: string): Promise<void> {
    if (!draft.telegramMessageId) return;

    const statusEmoji: Record<DraftStatus, string> = {
      draft: '📝',
      approved: '✅',
      rejected: '❌',
      published: '🚀',
    };

    const preview = this.formatDraftPreview(draft);
    const status = `\n\n${statusEmoji[draft.status]} <b>Status:</b> ${draft.status.toUpperCase()}`;

    // Remove buttons if action is final
    const isFinal = draft.status === 'published' || draft.status === 'rejected';

    await this.editMessage(draft.telegramMessageId, preview + status, {
      parseMode: 'HTML',
      replyMarkup: isFinal ? undefined : this.createDraftKeyboard(draft.id),
    });
  }

  /**
   * Send a simple notification.
   */
  async notify(message: string): Promise<void> {
    await this.sendMessage(message, { parseMode: 'HTML' });
  }

  /**
   * Send publish confirmation.
   */
  async notifyPublished(draft: Draft, tweetUrl: string): Promise<void> {
    const message = [
      `🚀 <b>Thread Published!</b>`,
      ``,
      `📦 <b>Project:</b> ${draft.projectId}`,
      `🔗 <a href="${tweetUrl}">View on X</a>`,
      `📊 ${draft.content.tweets.length} tweet(s)`,
    ].join('\n');

    await this.sendMessage(message, { parseMode: 'HTML' });
  }

  /**
   * Send error notification.
   */
  async notifyError(error: string, context?: string): Promise<void> {
    const message = [
      `⚠️ <b>Error Occurred</b>`,
      context ? `📍 <b>Context:</b> ${context}` : '',
      ``,
      `<code>${this.escapeHtml(error)}</code>`,
    ]
      .filter(Boolean)
      .join('\n');

    await this.sendMessage(message, { parseMode: 'HTML' });
  }

  /**
   * Send queue status.
   */
  async sendQueueStatus(drafts: DraftSummary[]): Promise<void> {
    if (drafts.length === 0) {
      await this.sendMessage('📭 No pending drafts in the queue.');
      return;
    }

    const lines = [`📋 <b>Pending Drafts (${drafts.length})</b>`, ``];

    drafts.slice(0, 10).forEach((draft, i) => {
      lines.push(
        `${i + 1}. <b>${draft.projectId}</b> - ${draft.tweetCount} tweet(s)`,
        `   ${draft.firstTweetPreview}`,
        `   <code>${draft.id.slice(0, 8)}...</code>`,
        ``
      );
    });

    if (drafts.length > 10) {
      lines.push(`<i>... and ${drafts.length - 10} more</i>`);
    }

    await this.sendMessage(lines.join('\n'), { parseMode: 'HTML' });
  }

  /**
   * Send statistics.
   */
  async sendStats(stats: {
    total: number;
    byStatus: Record<DraftStatus, number>;
    publishedThisWeek: number;
  }): Promise<void> {
    const message = [
      `📊 <b>Content Statistics</b>`,
      ``,
      `📝 Drafts: ${stats.byStatus.draft}`,
      `✅ Approved: ${stats.byStatus.approved}`,
      `🚀 Published: ${stats.byStatus.published}`,
      `❌ Rejected: ${stats.byStatus.rejected}`,
      ``,
      `📅 Published this week: ${stats.publishedThisWeek}`,
      `📦 Total content: ${stats.total}`,
    ].join('\n');

    await this.sendMessage(message, { parseMode: 'HTML' });
  }

  /**
   * Get webhook updates (for polling mode).
   */
  async getUpdates(offset?: number): Promise<TelegramUpdate[]> {
    const updates = await this.request<TelegramUpdate[]>('getUpdates', {
      offset,
      timeout: 30,
    });
    return updates;
  }

  /**
   * Set webhook URL.
   */
  async setWebhook(url: string): Promise<void> {
    await this.request('setWebhook', { url });
    logger.info(`Telegram webhook set to ${url}`);
  }

  /**
   * Delete webhook.
   */
  async deleteWebhook(): Promise<void> {
    await this.request('deleteWebhook');
    logger.info('Telegram webhook deleted');
  }

  /**
   * Get bot info.
   */
  async getMe(): Promise<{ id: number; first_name: string; username: string }> {
    return this.request('getMe');
  }
}

// Export singleton instance
export const telegramService = new TelegramService();
