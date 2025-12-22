/**
 * GitHub event types for webhook handling.
 */

/** A file changed in a commit or PR */
export interface ChangedFile {
  /** File path relative to repo root */
  path: string;
  /** Number of lines added */
  linesAdded: number;
  /** Number of lines removed */
  linesRemoved: number;
  /** File status: added, modified, deleted, renamed */
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  /** Previous path if renamed */
  previousPath?: string;
}

/** A commit in a push or PR */
export interface CommitInfo {
  /** Commit SHA */
  sha: string;
  /** Commit message */
  message: string;
  /** Author name */
  author: string;
  /** ISO timestamp */
  timestamp: string;
  /** Files changed in this commit */
  files?: ChangedFile[];
}

/** Repository information */
export interface RepositoryInfo {
  /** Repository name (e.g., "owner/repo") */
  fullName: string;
  /** Repository description */
  description: string;
  /** Primary programming language */
  language: string;
  /** Default branch name */
  defaultBranch: string;
  /** Repository URL */
  url: string;
}

/** Pull request information */
export interface PullRequestInfo {
  /** PR number */
  number: number;
  /** PR title */
  title: string;
  /** PR description/body */
  body: string;
  /** Source branch */
  sourceBranch: string;
  /** Target branch */
  targetBranch: string;
  /** PR URL */
  url: string;
  /** Author username */
  author: string;
  /** Merged at timestamp */
  mergedAt?: string;
}

/** Parsed GitHub push event */
export interface GitHubPushEvent {
  type: 'push';
  /** Repository info */
  repository: RepositoryInfo;
  /** Branch that was pushed to */
  branch: string;
  /** Commits in this push */
  commits: CommitInfo[];
  /** Compare URL showing diff */
  compareUrl: string;
  /** Pusher username */
  pusher: string;
  /** Before SHA (parent) */
  before: string;
  /** After SHA (head) */
  after: string;
}

/** Parsed GitHub PR merge event */
export interface GitHubPREvent {
  type: 'pr';
  /** Repository info */
  repository: RepositoryInfo;
  /** Pull request info */
  pullRequest: PullRequestInfo;
  /** Commits in this PR */
  commits: CommitInfo[];
  /** Full diff content */
  diff: string;
  /** Changed files */
  files: ChangedFile[];
}

/** Union type for all GitHub events */
export type GitHubEvent = GitHubPushEvent | GitHubPREvent;

/** Context passed to AI for content generation */
export interface ContentGenerationContext {
  /** Project ID */
  projectId: string;
  /** Event type */
  eventType: 'push' | 'pr';
  /** Repository info */
  repository: RepositoryInfo;
  /** PR info if applicable */
  pullRequest?: PullRequestInfo;
  /** Commits */
  commits: CommitInfo[];
  /** Diff content */
  diff: string;
  /** Changed files summary */
  files: ChangedFile[];
  /** Compare or PR URL */
  sourceUrl: string;
}
