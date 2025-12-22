/**
 * GitHub service for fetching PR and commit details.
 */

import { API_KEYS } from '../constants.js';
import type {
  ChangedFile,
  CommitInfo,
  ContentGenerationContext,
  GitHubPREvent,
  GitHubPushEvent,
  PullRequestInfo,
  RepositoryInfo,
} from '../types/index.js';
import logger from '../utils/logger.js';
import { defaultApiRetryCondition, retryWithBackoff } from '../utils/retry.js';

/**
 * GitHub API base URL
 */
const GITHUB_API = 'https://api.github.com';

/**
 * Make an authenticated GitHub API request.
 */
async function githubFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${GITHUB_API}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/vnd.github.v3+json',
      Authorization: `Bearer ${API_KEYS.GH_PAT}`,
      'User-Agent': 'commit-content-tracker',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error ${response.status}: ${error}`);
  }

  return response.json() as Promise<T>;
}

/**
 * GitHub service class.
 */
export class GitHubService {
  /**
   * Get repository information.
   */
  async getRepository(owner: string, repo: string): Promise<RepositoryInfo> {
    return retryWithBackoff(
      async () => {
        const data = await githubFetch<{
          full_name: string;
          description: string;
          language: string;
          default_branch: string;
          html_url: string;
        }>(`/repos/${owner}/${repo}`);

        return {
          fullName: data.full_name,
          description: data.description || '',
          language: data.language || 'Unknown',
          defaultBranch: data.default_branch,
          url: data.html_url,
        };
      },
      { shouldRetry: defaultApiRetryCondition, context: 'getRepository' }
    );
  }

  /**
   * Get commit details.
   */
  async getCommit(owner: string, repo: string, sha: string): Promise<CommitInfo> {
    return retryWithBackoff(
      async () => {
        const data = await githubFetch<{
          sha: string;
          commit: {
            message: string;
            author: { name: string; date: string };
          };
          files?: Array<{
            filename: string;
            additions: number;
            deletions: number;
            status: string;
            previous_filename?: string;
          }>;
        }>(`/repos/${owner}/${repo}/commits/${sha}`);

        const files: ChangedFile[] = (data.files || []).map((f) => ({
          path: f.filename,
          linesAdded: f.additions,
          linesRemoved: f.deletions,
          status: f.status as ChangedFile['status'],
          previousPath: f.previous_filename,
        }));

        return {
          sha: data.sha,
          message: data.commit.message,
          author: data.commit.author.name,
          timestamp: data.commit.author.date,
          files,
        };
      },
      { shouldRetry: defaultApiRetryCondition, context: 'getCommit' }
    );
  }

  /**
   * Get PR details.
   */
  async getPullRequest(owner: string, repo: string, prNumber: number): Promise<PullRequestInfo> {
    return retryWithBackoff(
      async () => {
        const data = await githubFetch<{
          number: number;
          title: string;
          body: string;
          head: { ref: string };
          base: { ref: string };
          html_url: string;
          user: { login: string };
          merged_at: string | null;
        }>(`/repos/${owner}/${repo}/pulls/${prNumber}`);

        return {
          number: data.number,
          title: data.title,
          body: data.body || '',
          sourceBranch: data.head.ref,
          targetBranch: data.base.ref,
          url: data.html_url,
          author: data.user.login,
          mergedAt: data.merged_at || undefined,
        };
      },
      { shouldRetry: defaultApiRetryCondition, context: 'getPullRequest' }
    );
  }

  /**
   * Get PR commits.
   */
  async getPullRequestCommits(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<CommitInfo[]> {
    return retryWithBackoff(
      async () => {
        const data = await githubFetch<
          Array<{
            sha: string;
            commit: {
              message: string;
              author: { name: string; date: string };
            };
          }>
        >(`/repos/${owner}/${repo}/pulls/${prNumber}/commits`);

        return data.map((c) => ({
          sha: c.sha,
          message: c.commit.message,
          author: c.commit.author.name,
          timestamp: c.commit.author.date,
        }));
      },
      { shouldRetry: defaultApiRetryCondition, context: 'getPRCommits' }
    );
  }

  /**
   * Get PR diff.
   */
  async getPullRequestDiff(owner: string, repo: string, prNumber: number): Promise<string> {
    return retryWithBackoff(
      async () => {
        const url = `${GITHUB_API}/repos/${owner}/${repo}/pulls/${prNumber}`;
        const response = await fetch(url, {
          headers: {
            Accept: 'application/vnd.github.v3.diff',
            Authorization: `Bearer ${API_KEYS.GH_PAT}`,
            'User-Agent': 'commit-content-tracker',
          },
        });

        if (!response.ok) {
          throw new Error(`GitHub API error ${response.status}`);
        }

        return response.text();
      },
      { shouldRetry: defaultApiRetryCondition, context: 'getPRDiff' }
    );
  }

  /**
   * Get PR changed files.
   */
  async getPullRequestFiles(owner: string, repo: string, prNumber: number): Promise<ChangedFile[]> {
    return retryWithBackoff(
      async () => {
        const data = await githubFetch<
          Array<{
            filename: string;
            additions: number;
            deletions: number;
            status: string;
            previous_filename?: string;
          }>
        >(`/repos/${owner}/${repo}/pulls/${prNumber}/files`);

        return data.map((f) => ({
          path: f.filename,
          linesAdded: f.additions,
          linesRemoved: f.deletions,
          status: f.status as ChangedFile['status'],
          previousPath: f.previous_filename,
        }));
      },
      { shouldRetry: defaultApiRetryCondition, context: 'getPRFiles' }
    );
  }

  /**
   * Get compare diff between two commits.
   */
  async getCompare(owner: string, repo: string, base: string, head: string): Promise<string> {
    return retryWithBackoff(
      async () => {
        const url = `${GITHUB_API}/repos/${owner}/${repo}/compare/${base}...${head}`;
        const response = await fetch(url, {
          headers: {
            Accept: 'application/vnd.github.v3.diff',
            Authorization: `Bearer ${API_KEYS.GH_PAT}`,
            'User-Agent': 'commit-content-tracker',
          },
        });

        if (!response.ok) {
          throw new Error(`GitHub API error ${response.status}`);
        }

        return response.text();
      },
      { shouldRetry: defaultApiRetryCondition, context: 'getCompare' }
    );
  }

  /**
   * Parse a GitHub push webhook payload.
   */
  async parsePushEvent(payload: Record<string, unknown>): Promise<GitHubPushEvent> {
    const repoData = payload.repository as Record<string, unknown>;
    const [owner, repo] = (repoData.full_name as string).split('/');

    const commits = (payload.commits as Array<Record<string, unknown>>) || [];
    const branch = (payload.ref as string).replace('refs/heads/', '');

    const repository = await this.getRepository(owner, repo);

    const commitInfos: CommitInfo[] = commits.map((c) => ({
      sha: c.id as string,
      message: c.message as string,
      author: (c.author as Record<string, string>).name,
      timestamp: c.timestamp as string,
    }));

    return {
      type: 'push',
      repository,
      branch,
      commits: commitInfos,
      compareUrl: payload.compare as string,
      pusher: (payload.pusher as Record<string, string>).name,
      before: payload.before as string,
      after: payload.after as string,
    };
  }

  /**
   * Parse a GitHub PR webhook payload.
   */
  async parsePREvent(payload: Record<string, unknown>): Promise<GitHubPREvent> {
    const prData = payload.pull_request as Record<string, unknown>;
    const repoData = payload.repository as Record<string, unknown>;
    const [owner, repo] = (repoData.full_name as string).split('/');
    const prNumber = prData.number as number;

    const repository = await this.getRepository(owner, repo);
    const pullRequest = await this.getPullRequest(owner, repo, prNumber);
    const commits = await this.getPullRequestCommits(owner, repo, prNumber);
    const diff = await this.getPullRequestDiff(owner, repo, prNumber);
    const files = await this.getPullRequestFiles(owner, repo, prNumber);

    return {
      type: 'pr',
      repository,
      pullRequest,
      commits,
      diff,
      files,
    };
  }

  /**
   * Build content generation context from a GitHub event.
   */
  buildContext(
    projectId: string,
    event: GitHubPushEvent | GitHubPREvent
  ): ContentGenerationContext {
    if (event.type === 'push') {
      return {
        projectId,
        eventType: 'push',
        repository: event.repository,
        commits: event.commits,
        diff: '', // Will be fetched if needed
        files: [],
        sourceUrl: event.compareUrl,
      };
    }

    return {
      projectId,
      eventType: 'pr',
      repository: event.repository,
      pullRequest: event.pullRequest,
      commits: event.commits,
      diff: event.diff,
      files: event.files,
      sourceUrl: event.pullRequest.url,
    };
  }
}

// Export singleton instance
export const githubService = new GitHubService();
