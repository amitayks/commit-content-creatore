/**
 * Telegram handler workflow.
 * Processes webhook updates from Telegram.
 */

import {
  configService,
  githubService,
  grokService,
  storageService,
  telegramService,
  xService,
} from '../services/index.js';
import type { TelegramUpdate } from '../services/telegram.service.js';
import logger from '../utils/logger.js';

/**
 * Handle a callback query (button press).
 */
async function handleCallback(callbackId: string, data: string, messageId: number): Promise<void> {
  const [action, draftId] = data.split(':');

  logger.info(`Handling callback: ${action} for draft ${draftId}`);

  const draft = await storageService.getDraft(draftId);
  if (!draft) {
    await telegramService.answerCallback(callbackId, '❌ Draft not found');
    return;
  }

  switch (action) {
    case 'approve': {
      const updated = await storageService.updateStatus(draftId, 'approved');
      if (updated) {
        await telegramService.answerCallback(callbackId, '✅ Approved! Will be published soon.');
        await telegramService.updateDraftMessage(updated, 'approved');
      }
      break;
    }

    case 'reject': {
      const updated = await storageService.updateStatus(draftId, 'rejected');
      if (updated) {
        await telegramService.answerCallback(callbackId, '❌ Rejected');
        await telegramService.updateDraftMessage(updated, 'rejected');
      }
      break;
    }

    case 'regenerate': {
      await telegramService.answerCallback(callbackId, '🔄 Regenerating...');
      await storageService.incrementRegeneration(draftId);

      // Rebuild context and regenerate
      configService.loadAll();
      const config = configService.get(draft.projectId);
      if (!config) {
        await telegramService.notify('❌ Project config not found');
        break;
      }

      try {
        const newContent = await grokService.generateContent(
          {
            projectId: draft.projectId,
            eventType: draft.source.type === 'pr' ? 'pr' : 'push',
            repository: { fullName: config.repository } as any,
            commits: [],
            diff: '',
            files: [],
            sourceUrl: draft.source.url,
          },
          {
            tone: config.content.tone,
            contentTypes: config.content.types,
            emojis: config.formatting.emojis,
            hashtags: [...config.formatting.hashtags.always, ...config.formatting.hashtags.project],
          }
        );

        draft.content = {
          format: newContent.format,
          tweets: newContent.tweets,
        };
        draft.updatedAt = new Date().toISOString();
        await storageService.saveDraft(draft);

        // Update preview
        await telegramService.editMessage(messageId, telegramService.formatDraftPreview(draft), {
          replyMarkup: telegramService.createDraftKeyboard(draftId),
        });
      } catch (error) {
        await telegramService.notify(`❌ Regeneration failed: ${error}`);
      }
      break;
    }

    case 'edit': {
      await telegramService.answerCallback(
        callbackId,
        'Reply to this message with: [tweet#]: new text'
      );
      await telegramService.notify(
        `To edit, reply with the format:\n<code>1: Your new tweet text here</code>\n\nTweet numbers are shown in the preview above.`
      );
      break;
    }

    default:
      await telegramService.answerCallback(callbackId, '❓ Unknown action');
  }
}

/**
 * Handle a text message (potential edit).
 */
async function handleMessage(text: string, replyToMessageId?: number): Promise<void> {
  // Check for commands
  if (text.startsWith('/')) {
    const command = text.split(' ')[0].toLowerCase();

    switch (command) {
      case '/pending':
      case '/queue': {
        const drafts = await storageService.listDrafts('draft');
        await telegramService.sendQueueStatus(drafts);
        break;
      }

      case '/approved': {
        const drafts = await storageService.listDrafts('approved');
        await telegramService.sendQueueStatus(drafts);
        break;
      }

      case '/stats': {
        const stats = await storageService.getStats();
        await telegramService.sendStats(stats);
        break;
      }

      case '/publish': {
        // Publish next approved draft
        const approved = await storageService.listDrafts('approved');
        if (approved.length === 0) {
          await telegramService.notify('📭 No approved drafts to publish');
          break;
        }

        const draft = await storageService.getDraft(approved[0].id);
        if (!draft) break;

        try {
          const result = await xService.publishDraft(draft);
          draft.publishedTweetId = result.tweetIds[0];
          draft.publishedTweetIds = result.tweetIds;
          await storageService.updateStatus(draft.id, 'published');
          await storageService.archiveDraft(draft.id);
          await telegramService.notifyPublished(draft, result.url);
        } catch (error) {
          await telegramService.notifyError(String(error), 'Publishing');
        }
        break;
      }

      case '/help':
      default: {
        await telegramService.notify(`
<b>Available Commands:</b>

/pending - Show drafts waiting for review
/approved - Show approved drafts in queue
/stats - Show content statistics
/publish - Publish next approved draft
/help - Show this help message

<b>To edit a draft:</b>
Reply to a draft preview with: <code>1: New text</code>
        `);
      }
    }
    return;
  }

  // Check for edit format: "1: new text"
  const editMatch = text.match(/^(\d+):\s*(.+)$/s);
  if (editMatch && replyToMessageId) {
    const tweetIndex = parseInt(editMatch[1], 10) - 1;
    const newText = editMatch[2].trim();

    // Find draft by telegram message ID
    const allDrafts = await storageService.listDrafts('draft');
    for (const summary of allDrafts) {
      const draft = await storageService.getDraft(summary.id);
      if (draft?.telegramMessageId === replyToMessageId) {
        if (newText.length > 280) {
          await telegramService.notify(`❌ Tweet too long: ${newText.length}/280 characters`);
          return;
        }

        const updated = await storageService.updateTweet(draft.id, tweetIndex, newText);
        if (updated) {
          await telegramService.editMessage(
            replyToMessageId,
            telegramService.formatDraftPreview(updated),
            { replyMarkup: telegramService.createDraftKeyboard(draft.id) }
          );
          await telegramService.notify('✅ Tweet updated!');
        } else {
          await telegramService.notify('❌ Failed to update tweet');
        }
        return;
      }
    }

    await telegramService.notify('❌ Could not find the draft to edit');
  }
}

/**
 * Process a single update.
 */
async function processUpdate(update: TelegramUpdate): Promise<void> {
  if (update.callback_query) {
    const { id, data, message } = update.callback_query;
    if (data && message) {
      await handleCallback(id, data, message.message_id);
    }
  } else if (update.message?.text) {
    await handleMessage(update.message.text, update.message.reply_to_message?.message_id);
  }
}

/**
 * Main workflow entry point.
 */
async function main(): Promise<void> {
  logger.info('Telegram handler workflow started');

  // Check for webhook payload (GitHub Actions webhook mode)
  const webhookPayload = process.env.TELEGRAM_WEBHOOK_PAYLOAD;
  if (webhookPayload) {
    const update = JSON.parse(webhookPayload) as TelegramUpdate;
    await processUpdate(update);
    return;
  }

  // Polling mode for local development
  logger.info('Running in polling mode...');
  let offset: number | undefined;

  while (true) {
    try {
      const updates = await telegramService.getUpdates(offset);

      for (const update of updates) {
        await processUpdate(update);
        offset = update.update_id + 1;
      }
    } catch (error) {
      logger.error('Polling error', { error });
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

main().catch((error) => {
  logger.error('Telegram handler failed', { error });
  process.exit(1);
});
