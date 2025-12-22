/**
 * Draft and content types for the commit content tracker.
 */

/** Status of a draft in the approval workflow */
export type DraftStatus = 'draft' | 'approved' | 'rejected' | 'published';

/** Format of the generated content */
export type ContentFormat = 'single' | 'thread';

/** Source type of the GitHub event */
export type SourceType = 'pr' | 'push' | 'manual';

/** A single tweet in a thread */
export interface Tweet {
  /** Tweet content (max 280 characters) */
  text: string;
  /** Optional media attachment path */
  mediaPath?: string;
}

/** Source information from GitHub */
export interface DraftSource {
  /** Type of GitHub event */
  type: SourceType;
  /** GitHub URL to the PR or commit */
  url: string;
  /** Branch name or PR number */
  ref: string;
  /** Commit SHAs included */
  commits: string[];
  /** PR title if applicable */
  prTitle?: string;
  /** PR description if applicable */
  prDescription?: string;
}

/** Generated content */
export interface DraftContent {
  /** Single tweet or thread */
  format: ContentFormat;
  /** Array of tweets */
  tweets: Tweet[];
  /** AI-generated image path if any */
  imagePath?: string;
}

/** A draft object stored in the system */
export interface Draft {
  /** Unique identifier (UUID) */
  id: string;
  /** Project ID this belongs to */
  projectId: string;
  /** Current status in the workflow */
  status: DraftStatus;
  /** ISO timestamp of creation */
  createdAt: string;
  /** ISO timestamp of last update */
  updatedAt: string;
  /** Source information from GitHub */
  source: DraftSource;
  /** Generated content */
  content: DraftContent;
  /** Telegram message ID for updating previews */
  telegramMessageId?: number;
  /** Published tweet ID after publishing */
  publishedTweetId?: string;
  /** All tweet IDs if a thread */
  publishedTweetIds?: string[];
  /** How many times this draft was regenerated */
  regenerationCount: number;
  /** Error message if generation/publishing failed */
  errorMessage?: string;
}

/** Summary of a draft for listing */
export interface DraftSummary {
  id: string;
  projectId: string;
  status: DraftStatus;
  createdAt: string;
  tweetCount: number;
  firstTweetPreview: string;
  sourceUrl: string;
}
