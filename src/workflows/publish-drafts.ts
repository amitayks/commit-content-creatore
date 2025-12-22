/**
 * Publish drafts workflow.
 * Publishes approved drafts to X.
 */

import { RATE_LIMITS } from '../constants.js';
import { storageService, telegramService, xService } from '../services/index.js';
import logger from '../utils/logger.js';

/**
 * Publish all approved drafts.
 */
async function publishApproved(): Promise<void> {
  const approved = await storageService.listDrafts('approved');

  if (approved.length === 0) {
    logger.info('No approved drafts to publish');
    return;
  }

  logger.info(`Found ${approved.length} approved drafts to publish`);

  let published = 0;
  const maxToPublish = Math.min(approved.length, RATE_LIMITS.X_DAILY_LIMIT);

  for (const summary of approved.slice(0, maxToPublish)) {
    const draft = await storageService.getDraft(summary.id);
    if (!draft) continue;

    try {
      logger.info(`Publishing draft ${draft.id}...`);

      const result = await xService.publishDraft(draft);

      draft.publishedTweetId = result.tweetIds[0];
      draft.publishedTweetIds = result.tweetIds;

      await storageService.updateStatus(draft.id, 'published');
      await storageService.archiveDraft(draft.id);

      // Notify via Telegram
      await telegramService.notifyPublished(draft, result.url);

      if (draft.telegramMessageId) {
        await telegramService.updateDraftMessage(draft, 'published');
      }

      published++;
      logger.info(`Published draft ${draft.id}: ${result.url}`);

      // Small delay between publishes to respect rate limits
      if (published < maxToPublish) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch (error) {
      logger.error(`Failed to publish draft ${draft.id}`, { error });
      await telegramService.notifyError(`Failed to publish draft: ${error}`, `Draft: ${draft.id}`);
    }
  }

  logger.info(`Published ${published}/${approved.length} drafts`);
}

/**
 * Main workflow entry point.
 */
async function main(): Promise<void> {
  logger.info('Publish drafts workflow started');

  await publishApproved();

  // Also run archive cleanup
  const cleaned = await storageService.cleanupArchive();
  if (cleaned > 0) {
    logger.info(`Cleaned up ${cleaned} old archived drafts`);
  }

  logger.info('Publish drafts workflow completed');
}

main().catch((error) => {
  logger.error('Publish workflow failed', { error });
  process.exit(1);
});
