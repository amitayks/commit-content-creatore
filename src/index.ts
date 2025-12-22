/**
 * Commit Content Tracker - Main entry point.
 *
 * This is the main orchestration module for the content tracker.
 * Individual workflows are run via separate entry points.
 */

import { validateRequiredEnvVars } from './constants.js';
import logger from './utils/logger.js';

async function main(): Promise<void> {
  logger.info('🚀 Commit Content Tracker starting...');

  // Validate environment
  const { valid, missing } = validateRequiredEnvVars();
  if (!valid) {
    logger.error('Missing required environment variables:', { missing });
    process.exit(1);
  }

  logger.info('✅ All required environment variables are set');
  logger.info('Ready to process content!');

  // Main entry point - typically used for testing
  // Real workflows are triggered via GitHub Actions
}

main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
