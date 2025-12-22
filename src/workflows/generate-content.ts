/**
 * Content generation workflow.
 * Triggered by GitHub webhooks or manually.
 */

import {
  configService,
  githubService,
  grokService,
  storageService,
  telegramService,
} from '../services/index.js';
import type { ContentGenerationContext, DraftSource, GitHubEvent, GitHubPushEvent } from '../types/index.js';
import logger from '../utils/logger.js';

/**
 * Process a GitHub event and generate content.
 */
async function processEvent(event: GitHubEvent): Promise<void> {
  const repository = event.repository.fullName;
  logger.info(`Processing ${event.type} event for ${repository}`);

  // Load project configs
  configService.loadAll();
  const projectConfig = configService.getByRepository(repository);

  if (!projectConfig) {
    logger.info(`No project config found for ${repository}, skipping`);
    return;
  }

  if (!projectConfig.enabled) {
    logger.info(`Project ${projectConfig.id} is disabled, skipping`);
    return;
  }

  // Check branch filter
  const branch = event.type === 'push' ? event.branch : event.pullRequest.targetBranch;
  if (!configService.matchesBranch(projectConfig, branch)) {
    logger.info(`Branch ${branch} doesn't match config, skipping`);
    return;
  }

  // Check file patterns
  const files =
    event.type === 'push'
      ? event.commits.flatMap((c) => c.files?.map((f) => f.path) || [])
      : event.files.map((f) => f.path);

  if (files.length > 0 && !configService.matchesFilePatterns(projectConfig, files)) {
    logger.info(`Files don't match patterns, skipping`);
    return;
  }

  // Check commit count limit (for PRs) - skip large PRs
  const commitCount = event.commits.length;
  const maxCommits = (projectConfig as any).triggers?.maxCommitsForGeneration || 10;
  if (commitCount > maxCommits) {
    logger.info(`PR has ${commitCount} commits (max: ${maxCommits}), skipping - too large for focused content`);
    return;
  }

  // Build context
  const context = githubService.buildContext(projectConfig.id, event);

  // If push event, fetch the diff
  if (event.type === 'push' && event.commits.length > 0) {
    const [owner, repo] = repository.split('/');
    try {
      context.diff = await githubService.getCompare(owner, repo, event.before, event.after);
    } catch {
      logger.warn('Could not fetch diff for push event');
    }
  }

  // Generate content
  logger.info(`Generating content for ${projectConfig.id}`);

  const content = await grokService.generateContent(context, {
    tone: projectConfig.content.tone,
    contentTypes: projectConfig.content.types,
    emojis: projectConfig.formatting.emojis,
    hashtags: [
      ...projectConfig.formatting.hashtags.always,
      ...projectConfig.formatting.hashtags.project,
    ],
  });

  logger.info(`Generated ${content.format}: ${content.tweets.length} tweets`);

  // Build source info
  const source: DraftSource = {
    type: event.type === 'push' ? 'push' : 'pr',
    url: event.type === 'push' ? event.compareUrl : event.pullRequest.url,
    ref: event.type === 'push' ? event.branch : `#${event.pullRequest.number}`,
    commits: event.commits.map((c) => c.sha),
    prTitle: event.type === 'pr' ? event.pullRequest.title : undefined,
    prDescription: event.type === 'pr' ? event.pullRequest.body : undefined,
  };

  // Create draft
  const draft = await storageService.createDraft({
    projectId: projectConfig.id,
    status: 'draft',
    source,
    content: {
      format: content.format,
      tweets: content.tweets,
    },
  });

  // Send Telegram notification
  try {
    const messageId = await telegramService.notifyNewDraft(draft);
    draft.telegramMessageId = messageId;
    await storageService.saveDraft(draft);
    logger.info(`Sent Telegram notification for draft ${draft.id}`);
  } catch (error) {
    logger.error('Failed to send Telegram notification', { error });
  }

  logger.info(`Created draft ${draft.id} for review`);
}

/**
 * Build a manual push event from a specific commit SHA.
 */
async function buildManualEvent(commitSha: string): Promise<GitHubEvent> {
  // Get repository info from environment
  const repo = process.env.GITHUB_REPOSITORY || 'amitayks/commit-content-creatore';
  const [owner, repoName] = repo.split('/');

  logger.info(`Building manual event for commit ${commitSha} in ${repo}`);

  const repository = await githubService.getRepository(owner, repoName);
  const commit = await githubService.getCommit(owner, repoName, commitSha);

  return {
    type: 'push',
    repository,
    branch: 'main',
    commits: [commit],
    compareUrl: `https://github.com/${repo}/commit/${commitSha}`,
    pusher: commit.author,
    before: '',
    after: commitSha,
  } as GitHubPushEvent;
}

/**
 * Main workflow entry point.
 */
async function main(): Promise<void> {
  logger.info('Content generation workflow started');

  // Check for manual commit SHA (workflow_dispatch)
  const manualCommitSha = process.env.MANUAL_COMMIT_SHA;
  const eventName = process.env.GITHUB_EVENT_NAME;

  let event: GitHubEvent;

  if (manualCommitSha && manualCommitSha.trim()) {
    // Manual trigger with specific commit
    logger.info(`Manual trigger with commit: ${manualCommitSha}`);
    event = await buildManualEvent(manualCommitSha.trim());
  } else if (eventName === 'workflow_dispatch') {
    // Manual trigger without commit - use latest
    const repo = process.env.GITHUB_REPOSITORY || '';
    const [owner, repoName] = repo.split('/');
    const sha = process.env.GITHUB_SHA || '';

    if (!sha) {
      logger.info('No commit SHA provided for manual trigger, skipping');
      return;
    }

    logger.info(`Manual trigger using current SHA: ${sha}`);
    event = await buildManualEvent(sha);
  } else {
    // Normal event-based trigger
    const eventPath = process.env.GITHUB_EVENT_PATH;

    if (!eventPath || !eventName) {
      logger.error('Missing GitHub event information');
      process.exit(1);
    }

    const { readFileSync } = await import('fs');
    const payload = JSON.parse(readFileSync(eventPath, 'utf-8'));

    if (eventName === 'push') {
      event = await githubService.parsePushEvent(payload);
    } else if (
      eventName === 'pull_request' &&
      payload.action === 'closed' &&
      payload.pull_request?.merged
    ) {
      event = await githubService.parsePREvent(payload);
    } else {
      logger.info(`Ignoring event: ${eventName}`);
      return;
    }
  }

  await processEvent(event);

  logger.info('Content generation workflow completed');
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  logger.error('Workflow failed', { message, stack });
  process.exit(1);
});

