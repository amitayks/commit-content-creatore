/**
 * Storage service for managing drafts as JSON files.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import path from 'path';
import { ARCHIVE_CONFIG, PATHS } from '../constants.js';
import type { Draft, DraftStatus, DraftSummary } from '../types/index.js';
import logger from '../utils/logger.js';

/**
 * Generate a UUID v4
 */
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Ensure a directory exists.
 */
function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Storage service for draft management.
 */
export class StorageService {
  private draftsDir: string;
  private publishedDir: string;

  constructor() {
    this.draftsDir = PATHS.DRAFTS_DIR;
    this.publishedDir = PATHS.PUBLISHED_DIR;
    this.ensureDirectories();
  }

  /**
   * Ensure storage directories exist.
   */
  private ensureDirectories(): void {
    ensureDir(this.draftsDir);
    ensureDir(this.publishedDir);
  }

  /**
   * Get the file path for a draft.
   */
  private getDraftPath(id: string): string {
    return path.join(this.draftsDir, `${id}.json`);
  }

  /**
   * Get the file path for an archived draft.
   */
  private getArchivedPath(draft: Draft): string {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.publishedDir, `${date}-${draft.id}.json`);
  }

  /**
   * Create a new draft.
   */
  async createDraft(
    draft: Omit<Draft, 'id' | 'createdAt' | 'updatedAt' | 'regenerationCount'>
  ): Promise<Draft> {
    const id = generateId();
    const now = new Date().toISOString();

    const newDraft: Draft = {
      ...draft,
      id,
      createdAt: now,
      updatedAt: now,
      regenerationCount: 0,
    };

    await this.saveDraft(newDraft);
    logger.info(`Created draft ${id}`, { projectId: draft.projectId });
    return newDraft;
  }

  /**
   * Save a draft to disk.
   */
  async saveDraft(draft: Draft): Promise<void> {
    const filePath = this.getDraftPath(draft.id);
    const tempPath = `${filePath}.tmp`;

    try {
      // Write to temp file first (atomic write)
      writeFileSync(tempPath, JSON.stringify(draft, null, 2), 'utf-8');
      // Rename to actual file
      const { renameSync } = await import('fs');
      renameSync(tempPath, filePath);
    } catch (error) {
      // Clean up temp file if it exists
      if (existsSync(tempPath)) {
        unlinkSync(tempPath);
      }
      throw error;
    }
  }

  /**
   * Get a draft by ID.
   */
  async getDraft(id: string): Promise<Draft | null> {
    const filePath = this.getDraftPath(id);

    if (!existsSync(filePath)) {
      return null;
    }

    try {
      const content = readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as Draft;
    } catch (error) {
      logger.error(`Failed to read draft ${id}`, { error });
      return null;
    }
  }

  /**
   * Update a draft's status.
   */
  async updateStatus(id: string, status: DraftStatus): Promise<Draft | null> {
    const draft = await this.getDraft(id);
    if (!draft) {
      logger.error(`Draft ${id} not found`);
      return null;
    }

    // Validate status transition
    if (!this.isValidTransition(draft.status, status)) {
      logger.error(`Invalid status transition: ${draft.status} -> ${status}`);
      return null;
    }

    draft.status = status;
    draft.updatedAt = new Date().toISOString();

    await this.saveDraft(draft);
    logger.info(`Updated draft ${id} status to ${status}`);
    return draft;
  }

  /**
   * Check if a status transition is valid.
   */
  private isValidTransition(from: DraftStatus, to: DraftStatus): boolean {
    const validTransitions: Record<DraftStatus, DraftStatus[]> = {
      draft: ['approved', 'rejected'],
      approved: ['published', 'draft', 'rejected'],
      rejected: ['draft'],
      published: [],
    };

    return validTransitions[from]?.includes(to) ?? false;
  }

  /**
   * Update a tweet's content in a draft.
   */
  async updateTweet(id: string, tweetIndex: number, newText: string): Promise<Draft | null> {
    const draft = await this.getDraft(id);
    if (!draft) {
      return null;
    }

    if (tweetIndex < 0 || tweetIndex >= draft.content.tweets.length) {
      logger.error(`Invalid tweet index ${tweetIndex} for draft ${id}`);
      return null;
    }

    if (newText.length > 280) {
      logger.error(`Tweet exceeds 280 characters: ${newText.length}`);
      return null;
    }

    draft.content.tweets[tweetIndex].text = newText;
    draft.updatedAt = new Date().toISOString();

    await this.saveDraft(draft);
    logger.info(`Updated tweet ${tweetIndex + 1} in draft ${id}`);
    return draft;
  }

  /**
   * Increment regeneration count.
   */
  async incrementRegeneration(id: string): Promise<Draft | null> {
    const draft = await this.getDraft(id);
    if (!draft) {
      return null;
    }

    draft.regenerationCount += 1;
    draft.updatedAt = new Date().toISOString();

    await this.saveDraft(draft);
    return draft;
  }

  /**
   * List all drafts with a specific status.
   */
  async listDrafts(status?: DraftStatus): Promise<DraftSummary[]> {
    const files = readdirSync(this.draftsDir).filter((f) => f.endsWith('.json'));
    const summaries: DraftSummary[] = [];

    for (const file of files) {
      try {
        const content = readFileSync(path.join(this.draftsDir, file), 'utf-8');
        const draft = JSON.parse(content) as Draft;

        if (!status || draft.status === status) {
          summaries.push({
            id: draft.id,
            projectId: draft.projectId,
            status: draft.status,
            createdAt: draft.createdAt,
            tweetCount: draft.content.tweets.length,
            firstTweetPreview: draft.content.tweets[0]?.text.substring(0, 50) + '...',
            sourceUrl: draft.source.url,
          });
        }
      } catch {
        // Skip invalid files
      }
    }

    // Sort by creation date, newest first
    return summaries.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Archive a published draft.
   */
  async archiveDraft(id: string): Promise<boolean> {
    const draft = await this.getDraft(id);
    if (!draft || draft.status !== 'published') {
      return false;
    }

    const archivePath = this.getArchivedPath(draft);
    const originalPath = this.getDraftPath(id);

    try {
      writeFileSync(archivePath, JSON.stringify(draft, null, 2), 'utf-8');
      unlinkSync(originalPath);
      logger.info(`Archived draft ${id}`);
      return true;
    } catch (error) {
      logger.error(`Failed to archive draft ${id}`, { error });
      return false;
    }
  }

  /**
   * Delete a draft.
   */
  async deleteDraft(id: string): Promise<boolean> {
    const filePath = this.getDraftPath(id);

    if (!existsSync(filePath)) {
      return false;
    }

    try {
      unlinkSync(filePath);
      logger.info(`Deleted draft ${id}`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clean up old archived content.
   */
  async cleanupArchive(): Promise<number> {
    const files = readdirSync(this.publishedDir).filter((f) => f.endsWith('.json'));
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - ARCHIVE_CONFIG.RETENTION_DAYS);

    let deletedCount = 0;

    for (const file of files) {
      try {
        const content = readFileSync(path.join(this.publishedDir, file), 'utf-8');
        const draft = JSON.parse(content) as Draft;
        const createdDate = new Date(draft.createdAt);

        if (createdDate < cutoffDate) {
          unlinkSync(path.join(this.publishedDir, file));
          deletedCount++;
        }
      } catch {
        // Skip invalid files
      }
    }

    if (deletedCount > 0) {
      logger.info(`Cleaned up ${deletedCount} old archived drafts`);
    }

    return deletedCount;
  }

  /**
   * Get statistics about drafts.
   */
  async getStats(): Promise<{
    total: number;
    byStatus: Record<DraftStatus, number>;
    publishedThisWeek: number;
  }> {
    const drafts = await this.listDrafts();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const byStatus: Record<DraftStatus, number> = {
      draft: 0,
      approved: 0,
      rejected: 0,
      published: 0,
    };

    let publishedThisWeek = 0;

    for (const draft of drafts) {
      byStatus[draft.status]++;
      if (draft.status === 'published' && new Date(draft.createdAt) > weekAgo) {
        publishedThisWeek++;
      }
    }

    // Also count archived
    const archivedFiles = readdirSync(this.publishedDir).filter((f) => f.endsWith('.json'));
    byStatus.published += archivedFiles.length;

    for (const file of archivedFiles) {
      try {
        const content = readFileSync(path.join(this.publishedDir, file), 'utf-8');
        const draft = JSON.parse(content) as Draft;
        if (new Date(draft.createdAt) > weekAgo) {
          publishedThisWeek++;
        }
      } catch {
        // Skip
      }
    }

    return {
      total: drafts.length + archivedFiles.length,
      byStatus,
      publishedThisWeek,
    };
  }
}

// Export singleton instance
export const storageService = new StorageService();
