/**
 * Database Service - D1 operations for drafts, chat state, published posts, and repos
 *
 * SECURITY: All data operations require and filter by chat_id for ownership verification
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
 * Get a draft by ID - requires chat_id for ownership verification
 */
export async function getDraft(env: Env, id: string, chatId: string): Promise<Draft | null> {
    return env.DB.prepare('SELECT * FROM drafts WHERE id = ? AND chat_id = ?')
        .bind(id, chatId)
        .first<Draft>();
}

/**
 * Get a draft by ID without ownership check (for internal use only, e.g., cron jobs)
 * SECURITY: Only use this for system operations with env.TELEGRAM_CHAT_ID
 */
export async function getDraftInternal(env: Env, id: string): Promise<Draft | null> {
    return env.DB.prepare('SELECT * FROM drafts WHERE id = ?')
        .bind(id)
        .first<Draft>();
}

/**
 * Get all drafts for a user, optionally filtered by status
 */
export async function getAllDrafts(
    env: Env,
    chatId: string,
    status?: DraftStatus,
    limit = 10,
    offset = 0
): Promise<Draft[]> {
    if (status) {
        const result = await env.DB.prepare(
            'SELECT * FROM drafts WHERE chat_id = ? AND status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
        )
            .bind(chatId, status, limit, offset)
            .all<Draft>();
        return result.results || [];
    }

    const result = await env.DB.prepare(
        'SELECT * FROM drafts WHERE chat_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    )
        .bind(chatId, limit, offset)
        .all<Draft>();
    return result.results || [];
}

/**
 * Count drafts for a user by status
 */
export async function countDrafts(env: Env, chatId: string, status?: DraftStatus): Promise<number> {
    if (status) {
        const result = await env.DB.prepare('SELECT COUNT(*) as count FROM drafts WHERE chat_id = ? AND status = ?')
            .bind(chatId, status)
            .first<{ count: number }>();
        return result?.count || 0;
    }

    const result = await env.DB.prepare('SELECT COUNT(*) as count FROM drafts WHERE chat_id = ?')
        .bind(chatId)
        .first<{ count: number }>();
    return result?.count || 0;
}

/**
 * Create a new draft with ownership
 */
export async function createDraft(
    env: Env,
    chatId: string,
    data: {
        pr_number: number;
        pr_title: string;
        commit_sha: string;
        content: string;
    }
): Promise<string> {
    const id = generateId();
    await env.DB.prepare(
        `INSERT INTO drafts (id, chat_id, pr_number, pr_title, commit_sha, content)
         VALUES (?, ?, ?, ?, ?, ?)`
    )
        .bind(id, chatId, data.pr_number, data.pr_title, data.commit_sha, data.content)
        .run();
    return id;
}

/**
 * Update draft status - verifies ownership
 */
export async function updateDraftStatus(
    env: Env,
    id: string,
    chatId: string,
    status: DraftStatus
): Promise<boolean> {
    const result = await env.DB.prepare(
        "UPDATE drafts SET status = ?, updated_at = datetime('now') WHERE id = ? AND chat_id = ?"
    )
        .bind(status, id, chatId)
        .run();
    return (result.meta?.changes ?? 0) > 0;
}

/**
 * Update draft content - verifies ownership
 */
export async function updateDraftContent(
    env: Env,
    id: string,
    chatId: string,
    content: string
): Promise<boolean> {
    const result = await env.DB.prepare(
        "UPDATE drafts SET content = ?, updated_at = datetime('now') WHERE id = ? AND chat_id = ?"
    )
        .bind(content, id, chatId)
        .run();
    return (result.meta?.changes ?? 0) > 0;
}

/**
 * Update draft fields - verifies ownership
 */
export async function updateDraft(
    env: Env,
    id: string,
    chatId: string,
    updates: { content?: string; image_url?: string | null }
): Promise<boolean> {
    const sets: string[] = [];
    const values: (string | null)[] = [];

    if (updates.content !== undefined) {
        sets.push('content = ?');
        values.push(updates.content);
    }
    if (updates.image_url !== undefined) {
        sets.push('image_url = ?');
        values.push(updates.image_url);
    }

    if (sets.length === 0) return false;

    sets.push("updated_at = datetime('now')");
    values.push(id, chatId);

    const result = await env.DB.prepare(
        `UPDATE drafts SET ${sets.join(', ')} WHERE id = ? AND chat_id = ?`
    )
        .bind(...values)
        .run();
    return (result.meta?.changes ?? 0) > 0;
}

/**
 * Schedule a draft - verifies ownership
 */
export async function scheduleDraft(
    env: Env,
    id: string,
    chatId: string,
    scheduledAt: string
): Promise<boolean> {
    const result = await env.DB.prepare(
        "UPDATE drafts SET status = 'scheduled', scheduled_at = ?, updated_at = datetime('now') WHERE id = ? AND chat_id = ?"
    )
        .bind(scheduledAt, id, chatId)
        .run();
    return (result.meta?.changes ?? 0) > 0;
}

/**
 * Get scheduled drafts that are due (for cron job)
 * SECURITY: Returns drafts for all users - only use in cron context
 */
export async function getDueDrafts(env: Env): Promise<Draft[]> {
    const result = await env.DB.prepare(
        "SELECT * FROM drafts WHERE status = 'scheduled' AND scheduled_at <= datetime('now')"
    ).all<Draft>();
    return result.results || [];
}

/**
 * Delete a draft - verifies ownership
 */
export async function deleteDraft(env: Env, id: string, chatId: string): Promise<boolean> {
    const result = await env.DB.prepare('DELETE FROM drafts WHERE id = ? AND chat_id = ?')
        .bind(id, chatId)
        .run();
    return (result.meta?.changes ?? 0) > 0;
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
 * Create a published record with ownership
 */
export async function createPublished(
    env: Env,
    chatId: string,
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
        `INSERT INTO published (id, chat_id, draft_id, pr_number, tweet_ids, tweet_url, image_url)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
        .bind(
            id,
            chatId,
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
 * Get published posts by PR number for a user
 */
export async function getPublishedByPR(env: Env, chatId: string, prNumber: number): Promise<Published[]> {
    const result = await env.DB.prepare(
        'SELECT * FROM published WHERE chat_id = ? AND pr_number = ? ORDER BY published_at DESC'
    )
        .bind(chatId, prNumber)
        .all<Published>();
    return result.results || [];
}

/**
 * Delete a published record - verifies ownership
 */
export async function deletePublished(env: Env, id: string, chatId: string): Promise<boolean> {
    const result = await env.DB.prepare('DELETE FROM published WHERE id = ? AND chat_id = ?')
        .bind(id, chatId)
        .run();
    return (result.meta?.changes ?? 0) > 0;
}

// ==================== REPOS ====================

/**
 * Get all repos for a user
 */
export async function getRepos(env: Env, chatId: string): Promise<WatchedRepo[]> {
    const result = await env.DB.prepare(
        'SELECT * FROM repos WHERE chat_id = ? ORDER BY created_at DESC'
    )
        .bind(chatId)
        .all<WatchedRepo>();
    return result.results || [];
}

/**
 * Get repos that are currently being watched for a user
 */
export async function getWatchingRepos(env: Env, chatId: string): Promise<WatchedRepo[]> {
    const result = await env.DB.prepare(
        'SELECT * FROM repos WHERE chat_id = ? AND is_watching = 1 ORDER BY created_at DESC'
    )
        .bind(chatId)
        .all<WatchedRepo>();
    return result.results || [];
}

/**
 * Get all watching repos (for GitHub webhook processing)
 * SECURITY: Only use in webhook context to match incoming events
 */
export async function getAllWatchingRepos(env: Env): Promise<WatchedRepo[]> {
    const result = await env.DB.prepare(
        'SELECT * FROM repos WHERE is_watching = 1 ORDER BY created_at DESC'
    ).all<WatchedRepo>();
    return result.results || [];
}

/**
 * Get a repo by ID - verifies ownership
 */
export async function getRepo(env: Env, id: string, chatId: string): Promise<WatchedRepo | null> {
    return env.DB.prepare('SELECT * FROM repos WHERE id = ? AND chat_id = ?')
        .bind(id, chatId)
        .first<WatchedRepo>();
}

/**
 * Get a repo by owner and repo name for a user
 */
export async function getRepoByOwnerRepo(
    env: Env,
    chatId: string,
    owner: string,
    repo: string
): Promise<WatchedRepo | null> {
    return env.DB.prepare('SELECT * FROM repos WHERE chat_id = ? AND owner = ? AND repo = ?')
        .bind(chatId, owner, repo)
        .first<WatchedRepo>();
}

/**
 * Get a repo by owner and repo name (for webhook processing)
 * SECURITY: Only use in GitHub webhook context
 */
export async function getRepoByOwnerRepoAny(
    env: Env,
    owner: string,
    repo: string
): Promise<WatchedRepo | null> {
    return env.DB.prepare('SELECT * FROM repos WHERE owner = ? AND repo = ?')
        .bind(owner, repo)
        .first<WatchedRepo>();
}

/**
 * Create a new repo with ownership
 */
export async function createRepo(
    env: Env,
    chatId: string,
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
        `INSERT INTO repos (id, chat_id, owner, repo, config, webhook_id)
         VALUES (?, ?, ?, ?, ?, ?)`
    )
        .bind(id, chatId, data.owner, data.repo, JSON.stringify(config), data.webhook_id || null)
        .run();

    return id;
}

/**
 * Update a repo - verifies ownership
 */
export async function updateRepo(
    env: Env,
    id: string,
    chatId: string,
    updates: {
        is_watching?: number;
        config?: RepoConfig;
        webhook_id?: string | null;
    }
): Promise<boolean> {
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

    if (sets.length === 0) return false;

    sets.push("updated_at = datetime('now')");
    values.push(id, chatId);

    const result = await env.DB.prepare(
        `UPDATE repos SET ${sets.join(', ')} WHERE id = ? AND chat_id = ?`
    )
        .bind(...values)
        .run();
    return (result.meta?.changes ?? 0) > 0;
}

/**
 * Delete a repo - verifies ownership
 */
export async function deleteRepo(env: Env, id: string, chatId: string): Promise<boolean> {
    const result = await env.DB.prepare('DELETE FROM repos WHERE id = ? AND chat_id = ?')
        .bind(id, chatId)
        .run();
    return (result.meta?.changes ?? 0) > 0;
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
