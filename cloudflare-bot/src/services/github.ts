/**
 * GitHub Service - Fetch commit and PR data across all owner repos
 */

import type { Env, PRData, CommitData, ContentSource } from '../types';

const GITHUB_API = 'https://api.github.com';

interface GitHubCommit {
    sha: string;
    commit: {
        message: string;
        author: { name: string; date: string };
    };
    repository?: {
        full_name: string;
    };
}

// Extended commit response with stats (from single commit endpoint)
interface GitHubCommitWithStats extends GitHubCommit {
    stats?: {
        additions: number;
        deletions: number;
        total: number;
    };
    files?: { filename: string }[];
    author?: { login: string } | null;
}

interface GitHubPR {
    number: number;
    title: string;
    body: string;
    merged_at: string;
    user: { login: string };
    additions: number;
    deletions: number;
    changed_files: number;
}

interface CommitSearchResult {
    total_count: number;
    items: Array<{
        sha: string;
        repository: {
            full_name: string;
        };
        commit: {
            message: string;
            author: { name: string; date: string };
        };
        author?: { login: string } | null;
    }>;
}

/**
 * Make authenticated GitHub API request
 */
async function githubFetch<T>(env: Env, path: string): Promise<T> {
    const response = await fetch(`${GITHUB_API}${path}`, {
        headers: {
            Authorization: `Bearer ${env.GITHUB_TOKEN}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'content-bot',
        },
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`GitHub API error ${response.status}: ${error}`);
    }

    return response.json() as Promise<T>;
}

/**
 * Search for a commit by SHA across all owner repos
 * Returns the commit and the repo it was found in
 */
async function findCommitBysha(env: Env, sha: string): Promise<{ repo: string; commit: CommitSearchResult['items'][0] } | null> {
    try {
        // If GITHUB_OWNER is set, search scoped to that owner first
        if (env.GITHUB_OWNER) {
            const searchResult = await githubFetch<CommitSearchResult>(
                env,
                `/search/commits?q=hash:${sha}+author:${env.GITHUB_OWNER}`
            );

            if (searchResult.items.length > 0) {
                return {
                    repo: searchResult.items[0].repository.full_name,
                    commit: searchResult.items[0],
                };
            }

            const broaderSearch = await githubFetch<CommitSearchResult>(
                env,
                `/search/commits?q=hash:${sha}+user:${env.GITHUB_OWNER}`
            );

            if (broaderSearch.items.length > 0) {
                return {
                    repo: broaderSearch.items[0].repository.full_name,
                    commit: broaderSearch.items[0],
                };
            }
        }

        // Fallback: search by hash only (works for any authenticated user)
        const fallbackSearch = await githubFetch<CommitSearchResult>(
            env,
            `/search/commits?q=hash:${sha}`
        );

        if (fallbackSearch.items.length === 0) {
            return null;
        }

        return {
            repo: fallbackSearch.items[0].repository.full_name,
            commit: fallbackSearch.items[0],
        };
    } catch (error) {
        console.error('Commit search error:', error);
        return null;
    }
}

/**
 * Get commit details from a specific repo
 */
export async function getCommit(env: Env, repo: string, sha: string): Promise<GitHubCommitWithStats> {
    return githubFetch<GitHubCommitWithStats>(env, `/repos/${repo}/commits/${sha}`);
}

/**
 * Find the PR that contains a specific commit
 */
export async function getPRForCommit(env: Env, sha: string): Promise<{ repo: string; pr: PRData } | null> {
    // First find which repo has this commit
    const found = await findCommitBysha(env, sha);
    if (!found) {
        return null;
    }

    const { repo } = found;

    try {
        // Use the GitHub API to find PRs associated with this commit
        const prs = await githubFetch<{ number: number; merged_at: string | null }[]>(
            env,
            `/repos/${repo}/commits/${sha}/pulls`
        );

        // Find merged PRs
        const mergedPRs = prs.filter(pr => pr.merged_at !== null);

        if (mergedPRs.length === 0) {
            // Fallback: try search API
            const searchResult = await githubFetch<{ items: { number: number }[] }>(
                env,
                `/search/issues?q=repo:${repo}+is:pr+is:merged+${sha}`
            );

            if (!searchResult.items || searchResult.items.length === 0) {
                return null;
            }

            const pr = await getPR(env, repo, searchResult.items[0].number);
            return { repo, pr };
        }

        // Get full PR details
        const pr = await getPR(env, repo, mergedPRs[0].number);
        return { repo, pr };
    } catch (error) {
        console.error('PR lookup error:', error);
        return null;
    }
}

/**
 * Get PR details with stats, commit messages, and file names
 */
export async function getPR(env: Env, repo: string, number: number): Promise<PRData> {
    const pr = await githubFetch<GitHubPR>(env, `/repos/${repo}/pulls/${number}`);

    // Get commits in this PR (includes commit messages)
    const commits = await githubFetch<GitHubCommit[]>(
        env,
        `/repos/${repo}/pulls/${number}/commits`
    );

    // Get changed files in this PR
    const files = await githubFetch<{ filename: string }[]>(
        env,
        `/repos/${repo}/pulls/${number}/files`
    );

    return {
        number: pr.number,
        title: pr.title,
        body: pr.body || '',
        commits: commits.map((c) => c.sha),
        commitMessages: commits.map((c) => c.commit.message.split('\n')[0]),
        fileNames: files.map((f) => f.filename),
        files_changed: pr.changed_files,
        additions: pr.additions,
        deletions: pr.deletions,
        merged_at: pr.merged_at,
        author: pr.user.login,
    };
}

/**
 * Get commit data with stats (for direct commits)
 */
export async function getCommitData(env: Env, sha: string): Promise<CommitData> {
    // First find which repo has this commit
    const found = await findCommitBysha(env, sha);
    if (!found) {
        throw new Error(`Commit ${sha} not found in any accessible repo`);
    }

    const { repo, commit: searchCommit } = found;

    // Get full commit details from the repo
    const commit = await getCommit(env, repo, sha);

    // Parse commit message: first line is title, rest is body
    const [title, ...bodyLines] = commit.commit.message.split('\n');

    return {
        sha: commit.sha,
        title: title || 'Untitled commit',
        body: bodyLines.join('\n').trim(),
        commitMessages: [title || 'Untitled commit'],
        fileNames: commit.files?.map(f => f.filename) || [],
        files_changed: commit.files?.length || 0,
        additions: commit.stats?.additions || 0,
        deletions: commit.stats?.deletions || 0,
        author: commit.author?.login || searchCommit.author?.login || commit.commit.author.name,
        date: commit.commit.author.date,
    };
}

/**
 * Get content source - tries PR first, falls back to direct commit
 * Returns a ContentSource that can be used for content generation
 */
export async function getContentSource(env: Env, sha: string): Promise<ContentSource> {
    // First, try to find a PR for this commit
    const result = await getPRForCommit(env, sha);

    if (result) {
        console.log(`Found PR #${result.pr.number} in repo ${result.repo}`);
        return { type: 'pr', data: result.pr, repo: result.repo };
    }

    // Fallback: use commit data directly
    console.log('No PR found, using commit data directly');
    // Try to find repo name for the commit
    const found = await findCommitBysha(env, sha);
    const commitData = await getCommitData(env, sha);
    return { type: 'commit', data: commitData, repo: found?.repo };
}

// ==================== OVERVIEW BOOTSTRAP ====================

interface GitHubReadmeResponse {
    content: string;
    encoding: string;
}

export interface PRSummary {
    number: number;
    title: string;
    body: string;
    merged_at: string;
}

/**
 * Fetch repo README content via GitHub API
 * Returns decoded text or null if no README
 */
export async function fetchRepoReadme(env: Env, owner: string, repo: string): Promise<string | null> {
    try {
        const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/readme`, {
            headers: {
                Authorization: `Bearer ${env.GITHUB_TOKEN}`,
                Accept: 'application/vnd.github.v3+json',
                'User-Agent': 'content-bot',
            },
        });

        if (!response.ok) {
            if (response.status === 404) return null;
            return null;
        }

        const data = await response.json() as GitHubReadmeResponse;
        if (data.encoding === 'base64' && data.content) {
            // Decode base64 content
            const decoded = atob(data.content.replace(/\n/g, ''));
            return decoded;
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Fetch recent merged PRs for a repo
 */
export async function fetchRecentMergedPRs(
    env: Env,
    owner: string,
    repo: string,
    count: number = 10
): Promise<PRSummary[]> {
    try {
        const prs = await githubFetch<Array<{
            number: number;
            title: string;
            body: string | null;
            merged_at: string | null;
        }>>(
            env,
            `/repos/${owner}/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=${count}`
        );

        return prs
            .filter(pr => pr.merged_at !== null)
            .map(pr => ({
                number: pr.number,
                title: pr.title,
                body: pr.body || '',
                merged_at: pr.merged_at!,
            }));
    } catch {
        return [];
    }
}

/**
 * Validate that a repository exists and is accessible
 */
export async function validateRepo(
    env: Env,
    owner: string,
    repo: string
): Promise<boolean> {
    try {
        const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, {
            headers: {
                Authorization: `token ${env.GITHUB_TOKEN}`,
                Accept: 'application/vnd.github.v3+json',
                'User-Agent': 'content-bot',
            },
        });

        if (response.ok) {
            console.log(`Repository ${owner}/${repo} is valid and accessible`);
            return true;
        }

        if (response.status === 404) {
            console.log(`Repository ${owner}/${repo} not found`);
            return false;
        }

        console.log(`Failed to validate ${owner}/${repo}: ${response.status}`);
        return false;
    } catch (error) {
        console.error(`Error validating repo ${owner}/${repo}:`, error);
        return false;
    }
}

