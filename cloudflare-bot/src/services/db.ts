/**
 * Database Service - D1 operations for drafts, chat state, published posts, and repos
 */

import type { Env, Draft, ChatState, Published, DraftStatus, ChatContext, WatchedRepo, RepoConfig } from '../types';
import { DEFAULT_REPO_CONFIG } from '../types';

/**
 * Generate a UUID v4
 */
function generateId(): string {
    return crypto.randomUUID();
}

// ==================== DRAFTS ====================

/**
 * Get a draft by ID
 */
export async function getDraft(env: Env, id: string): Promise<Draft | null> {
    return env.DB.prepare('SELECT * FROM drafts WHERE id = ?')
        .bind(id)
        .first<Draft>();
}

/**
 * Get all drafts, optionally filtered by status
 */
export async function getAllDrafts(
    env: Env,
    status?: DraftStatus,
    limit = 10,
    offset = 0
): Promise<Draft[]> {
    if (status) {
        const result = await env.DB.prepare(
            'SELECT * FROM drafts WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
        )
            .bind(status, limit, offset)
            .all<Draft>();
        return result.results || [];
    }

    const result = await env.DB.prepare(
        'SELECT * FROM drafts ORDER BY created_at DESC LIMIT ? OFFSET ?'
    )
        .bind(limit, offset)
        .all<Draft>();
    return result.results || [];
}

/**
 * Count drafts by status
 */
export async function countDrafts(env: Env, status?: DraftStatus): Promise<number> {
    if (status) {
        const result = await env.DB.prepare('SELECT COUNT(*) as count FROM drafts WHERE status = ?')
            .bind(status)
            .first<{ count: number }>();
        return result?.count || 0;
    }

    const result = await env.DB.prepare('SELECT COUNT(*) as count FROM drafts')
        .first<{ count: number }>();
    return result?.count || 0;
}

/**
 * Create a new draft
 */
export async function createDraft(
    env: Env,
    data: {
        pr_number: number;
        pr_title: string;
        commit_sha: string;
        content: string;
    }
): Promise<string> {
    const id = generateId();
    await env.DB.prepare(
        `INSERT INTO drafts (id, pr_number, pr_title, commit_sha, content)
     VALUES (?, ?, ?, ?, ?)`
    )
        .bind(id, data.pr_number, data.pr_title, data.commit_sha, data.content)
        .run();
    return id;
}

/**
 * Update draft status
 */
export async function updateDraftStatus(
    env: Env,
    id: string,
    status: DraftStatus
): Promise<void> {
    await env.DB.prepare(
        "UPDATE drafts SET status = ?, updated_at = datetime('now') WHERE id = ?"
    )
        .bind(status, id)
        .run();
}

/**
 * Update draft content (for regeneration)
 */
export async function updateDraftContent(
    env: Env,
    id: string,
    content: string
): Promise<void> {
    await env.DB.prepare(
        "UPDATE drafts SET content = ?, updated_at = datetime('now') WHERE id = ?"
    )
        .bind(content, id)
        .run();
}

/**
 * Schedule a draft
 */
export async function scheduleDraft(
    env: Env,
    id: string,
    scheduledAt: string
): Promise<void> {
    await env.DB.prepare(
        "UPDATE drafts SET status = 'scheduled', scheduled_at = ?, updated_at = datetime('now') WHERE id = ?"
    )
        .bind(scheduledAt, id)
        .run();
}

/**
 * Get scheduled drafts that are due
 */
export async function getDueDrafts(env: Env): Promise<Draft[]> {
    const result = await env.DB.prepare(
        "SELECT * FROM drafts WHERE status = 'scheduled' AND scheduled_at <= datetime('now')"
    ).all<Draft>();
    return result.results || [];
}

/**
 * Delete a draft
 */
export async function deleteDraft(env: Env, id: string): Promise<void> {
    await env.DB.prepare('DELETE FROM drafts WHERE id = ?').bind(id).run();
}

// ==================== CHAT STATE ====================

/**
 * Get chat state, creating if not exists
 */
export async function getChatState(env: Env, chatId: string): Promise<ChatState> {
    const existing = await env.DB.prepare('SELECT * FROM chat_state WHERE chat_id = ?')
        .bind(chatId)
        .first<ChatState>();

    if (existing) return existing;

    // Create new state
    await env.DB.prepare('INSERT INTO chat_state (chat_id) VALUES (?)').bind(chatId).run();

    return {
        chat_id: chatId,
        message_id: null,
        current_view: 'home',
        context: null,
        updated_at: new Date().toISOString(),
    };
}

/**
 * Update chat state
 */
export async function updateChatState(
    env: Env,
    chatId: string,
    updates: {
        message_id?: number;
        current_view?: string;
        context?: ChatContext | null;
    }
): Promise<void> {
    const sets: string[] = [];
    const values: (string | number | null)[] = [];

    if (updates.message_id !== undefined) {
        sets.push('message_id = ?');
        values.push(updates.message_id);
    }
    if (updates.current_view !== undefined) {
        sets.push('current_view = ?');
        values.push(updates.current_view);
    }
    if (updates.context !== undefined) {
        sets.push('context = ?');
        values.push(updates.context ? JSON.stringify(updates.context) : null);
    }

    sets.push("updated_at = datetime('now')");
    values.push(chatId);

    await env.DB.prepare(
        `UPDATE chat_state SET ${sets.join(', ')} WHERE chat_id = ?`
    )
        .bind(...values)
        .run();
}

/**
 * Parse context from chat state
 */
export function parseContext(state: ChatState): ChatContext {
    if (!state.context) return {};
    try {
        return JSON.parse(state.context) as ChatContext;
    } catch {
        return {};
    }
}

// ==================== PUBLISHED ====================

/**
 * Create a published record
 */
export async function createPublished(
    env: Env,
    data: {
        draft_id: string;
        pr_number: number;
        tweet_ids: string[];
        tweet_url: string;
        image_url?: string;
    }
): Promise<string> {
    const id = generateId();
    await env.DB.prepare(
        `INSERT INTO published (id, draft_id, pr_number, tweet_ids, tweet_url, image_url)
     VALUES (?, ?, ?, ?, ?, ?)`
    )
        .bind(
            id,
            data.draft_id,
            data.pr_number,
            JSON.stringify(data.tweet_ids),
            data.tweet_url,
            data.image_url || null
        )
        .run();
    return id;
}

/**
 * Get published posts by PR number
 */
export async function getPublishedByPR(env: Env, prNumber: number): Promise<Published[]> {
    const result = await env.DB.prepare(
        'SELECT * FROM published WHERE pr_number = ? ORDER BY published_at DESC'
    )
        .bind(prNumber)
        .all<Published>();
    return result.results || [];
}

/**
 * Delete a published record
 */
export async function deletePublished(env: Env, id: string): Promise<void> {
    await env.DB.prepare('DELETE FROM published WHERE id = ?').bind(id).run();
}

// ==================== REPOS ====================

/**
 * Get all repos
 */
export async function getRepos(env: Env): Promise<WatchedRepo[]> {
    const result = await env.DB.prepare(
        'SELECT * FROM repos ORDER BY created_at DESC'
    ).all<WatchedRepo>();
    return result.results || [];
}

/**
 * Get repos that are currently being watched
 */
export async function getWatchingRepos(env: Env): Promise<WatchedRepo[]> {
    const result = await env.DB.prepare(
        'SELECT * FROM repos WHERE is_watching = 1 ORDER BY created_at DESC'
    ).all<WatchedRepo>();
    return result.results || [];
}

/**
 * Get a repo by ID
 */
export async function getRepo(env: Env, id: string): Promise<WatchedRepo | null> {
    return env.DB.prepare('SELECT * FROM repos WHERE id = ?')
        .bind(id)
        .first<WatchedRepo>();
}

/**
 * Get a repo by owner and repo name
 */
export async function getRepoByOwnerRepo(
    env: Env,
    owner: string,
    repo: string
): Promise<WatchedRepo | null> {
    return env.DB.prepare('SELECT * FROM repos WHERE owner = ? AND repo = ?')
        .bind(owner, repo)
        .first<WatchedRepo>();
}

/**
 * Create a new repo
 */
export async function createRepo(
    env: Env,
    data: {
        owner: string;
        repo: string;
        webhook_id?: string;
        config?: RepoConfig;
    }
): Promise<string> {
    const id = generateId();
    const config = data.config || DEFAULT_REPO_CONFIG;

    await env.DB.prepare(
        `INSERT INTO repos (id, owner, repo, config, webhook_id)
         VALUES (?, ?, ?, ?, ?)`
    )
        .bind(id, data.owner, data.repo, JSON.stringify(config), data.webhook_id || null)
        .run();

    return id;
}

/**
 * Update a repo
 */
export async function updateRepo(
    env: Env,
    id: string,
    updates: {
        is_watching?: number;
        config?: RepoConfig;
        webhook_id?: string | null;
    }
): Promise<void> {
    const sets: string[] = [];
    const values: (string | number | null)[] = [];

    if (updates.is_watching !== undefined) {
        sets.push('is_watching = ?');
        values.push(updates.is_watching);
    }
    if (updates.config !== undefined) {
        sets.push('config = ?');
        values.push(JSON.stringify(updates.config));
    }
    if (updates.webhook_id !== undefined) {
        sets.push('webhook_id = ?');
        values.push(updates.webhook_id);
    }

    if (sets.length === 0) return;

    sets.push("updated_at = datetime('now')");
    values.push(id);

    await env.DB.prepare(
        `UPDATE repos SET ${sets.join(', ')} WHERE id = ?`
    )
        .bind(...values)
        .run();
}

/**
 * Delete a repo
 */
export async function deleteRepo(env: Env, id: string): Promise<void> {
    await env.DB.prepare('DELETE FROM repos WHERE id = ?').bind(id).run();
}

/**
 * Parse config from repo record
 */
export function parseRepoConfig(repo: WatchedRepo): RepoConfig {
    try {
        return JSON.parse(repo.config) as RepoConfig;
    } catch {
        return DEFAULT_REPO_CONFIG;
    }
}

