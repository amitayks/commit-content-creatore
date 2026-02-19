/**
 * Database Service - D1 operations for drafts, chat state, published posts, and repos
 *
 * SECURITY: All data operations require and filter by chat_id for ownership verification
 */

import type { Env, Draft, ChatState, Published, DraftStatus, ChatContext, WatchedRepo, RepoConfig, RepoOverview, OverviewPatch, VideoDraft, VideoDraftStatus, VideoPublished, VideoPreset, VideoConfig, VideoSettings, TwitterAccount, TwitterAccountConfig, TwitterAccountOverview, TwitterTweet, PersonaCache } from '../types';
import { DEFAULT_REPO_CONFIG, DEFAULT_TWITTER_ACCOUNT_CONFIG } from '../types';
import { logInfo, logError } from './security';

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
 * Check if a draft already exists for a commit SHA (idempotency for webhooks)
 */
export async function getDraftByCommitSha(env: Env, chatId: string, commitSha: string): Promise<Draft | null> {
    return env.DB.prepare('SELECT * FROM drafts WHERE chat_id = ? AND commit_sha = ? LIMIT 1')
        .bind(chatId, commitSha)
        .first<Draft>();
}

/**
 * Get all drafts for a user, optionally filtered by status
 */
export async function getAllDrafts(
    env: Env,
    chatId: string,
    status?: DraftStatus,
    limit = 5,
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
 * Get the next scheduled draft (soonest scheduled_at)
 */
export async function getNextScheduledDraft(env: Env, chatId: string): Promise<Draft | null> {
    return env.DB.prepare(
        "SELECT * FROM drafts WHERE chat_id = ? AND status = 'scheduled' ORDER BY scheduled_at ASC LIMIT 1"
    )
        .bind(chatId)
        .first<Draft>();
}

/**
 * Get draft counts grouped by status
 */
export async function getDraftStatusCounts(env: Env, chatId: string): Promise<Record<string, number>> {
    const result = await env.DB.prepare(
        'SELECT status, COUNT(*) as count FROM drafts WHERE chat_id = ? GROUP BY status'
    )
        .bind(chatId)
        .all<{ status: string; count: number }>();
    const counts: Record<string, number> = {};
    for (const row of result.results || []) {
        counts[row.status] = row.count;
    }
    return counts;
}

/**
 * Get drafts by source type, filtered by allowed statuses
 */
export async function getDraftsBySource(
    env: Env,
    chatId: string,
    source: string,
    statuses: string[],
    limit = 5,
    offset = 0
): Promise<Draft[]> {
    const placeholders = statuses.map(() => '?').join(', ');
    const result = await env.DB.prepare(
        `SELECT * FROM drafts WHERE chat_id = ? AND source = ? AND status IN (${placeholders}) ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
        .bind(chatId, source, ...statuses, limit, offset)
        .all<Draft>();
    return result.results || [];
}

/**
 * Count handwritten drafts (source='handwrite', status='draft')
 */
export async function getHandwriteDraftCount(env: Env, chatId: string): Promise<number> {
    const result = await env.DB.prepare(
        "SELECT COUNT(*) as count FROM drafts WHERE chat_id = ? AND source = 'handwrite' AND status = 'draft'"
    )
        .bind(chatId)
        .first<{ count: number }>();
    return result?.count || 0;
}

/**
 * Count drafts by source
 */
export async function countDraftsBySource(env: Env, chatId: string, source: string, statuses: string[]): Promise<number> {
    const placeholders = statuses.map(() => '?').join(', ');
    const result = await env.DB.prepare(
        `SELECT COUNT(*) as count FROM drafts WHERE chat_id = ? AND source = ? AND status IN (${placeholders})`
    )
        .bind(chatId, source, ...statuses)
        .first<{ count: number }>();
    return result?.count || 0;
}

/**
 * Get published record by draft ID
 */
export async function getPublishedByDraft(env: Env, chatId: string, draftId: string): Promise<Published | null> {
    return env.DB.prepare(
        'SELECT * FROM published WHERE chat_id = ? AND draft_id = ? LIMIT 1'
    )
        .bind(chatId, draftId)
        .first<Published>();
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
        source?: string;
        status?: string;
        original_tweet_id?: string;
        original_tweet_url?: string;
    }
): Promise<string> {
    const id = generateId();
    const source = data.source || 'auto';
    const status = data.status || 'draft';
    await env.DB.prepare(
        `INSERT INTO drafts (id, chat_id, pr_number, pr_title, commit_sha, content, source, status, original_tweet_id, original_tweet_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
        .bind(id, chatId, data.pr_number, data.pr_title, data.commit_sha, data.content, source, status, data.original_tweet_id || null, data.original_tweet_url || null)
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
    // Normalize to SQLite datetime format (YYYY-MM-DD HH:MM:SS) for consistent comparison
    const normalized = scheduledAt.replace('T', ' ').replace(/\.\d{3}Z$/, '').replace('Z', '');
    const result = await env.DB.prepare(
        "UPDATE drafts SET status = 'scheduled', scheduled_at = ?, updated_at = datetime('now') WHERE id = ? AND chat_id = ?"
    )
        .bind(normalized, id, chatId)
        .run();
    return (result.meta?.changes ?? 0) > 0;
}

/**
 * Get scheduled drafts that are due (for cron job)
 * SECURITY: Returns drafts for all users - only use in cron context
 */
export async function getDueDrafts(env: Env): Promise<Draft[]> {
    // Replace 'T' with space to normalize ISO 8601 format for SQLite comparison
    // scheduled_at is stored as ISO (2026-02-10T08:10:00.000Z)
    // datetime('now') returns (2026-02-10 08:48:37)
    const result = await env.DB.prepare(
        "SELECT * FROM drafts WHERE status = 'scheduled' AND REPLACE(scheduled_at, 'T', ' ') <= datetime('now')"
    ).all<Draft>();
    return result.results || [];
}

/**
 * Get scheduled drafts that are due for a specific user (for per-user cron fan-out)
 */
export async function getDueDraftsByUser(env: Env, chatId: string): Promise<Draft[]> {
    const result = await env.DB.prepare(
        "SELECT * FROM drafts WHERE chat_id = ? AND status = 'scheduled' AND REPLACE(scheduled_at, 'T', ' ') <= datetime('now')"
    )
        .bind(chatId)
        .all<Draft>();
    return result.results || [];
}

/**
 * Get stale generating video drafts for a specific user (for per-user cron fan-out)
 */
export async function getStaleGeneratingDraftsByUser(env: Env, chatId: string, olderThanMinutes: number): Promise<import('../types').VideoDraft[]> {
    const result = await env.DB.prepare(
        `SELECT * FROM video_drafts WHERE chat_id = ? AND status = 'generating' AND updated_at <= datetime('now', '-' || ? || ' minutes')`
    )
        .bind(chatId, olderThanMinutes)
        .all<import('../types').VideoDraft>();
    return result.results || [];
}

/**
 * Get scheduled video drafts for a specific user (for per-user cron fan-out)
 */
export async function getScheduledVideoDraftsByUser(env: Env, chatId: string): Promise<import('../types').VideoDraft[]> {
    const result = await env.DB.prepare(
        "SELECT * FROM video_drafts WHERE chat_id = ? AND status = 'scheduled' ORDER BY created_at ASC"
    )
        .bind(chatId)
        .all<import('../types').VideoDraft>();
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
    const existing = await env.DB.prepare(
        'SELECT chat_id, message_id, current_view, context, timezone, updated_at FROM users WHERE chat_id = ?'
    )
        .bind(chatId)
        .first<ChatState>();

    if (existing) return existing;

    return {
        chat_id: chatId,
        message_id: null,
        current_view: 'home',
        context: null,
        timezone: 'UTC',
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
        `UPDATE users SET ${sets.join(', ')} WHERE chat_id = ?`
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

// ==================== TIMEZONE ====================

/**
 * Get timezone for a chat (defaults to 'UTC')
 */
export async function getTimezone(env: Env, chatId: string): Promise<string> {
    const result = await env.DB.prepare('SELECT timezone FROM users WHERE chat_id = ?')
        .bind(chatId)
        .first<{ timezone: string | null }>();
    return result?.timezone || 'UTC';
}

/**
 * Set timezone for a chat
 */
export async function setTimezone(env: Env, chatId: string, tz: string): Promise<void> {
    await env.DB.prepare(
        "UPDATE users SET timezone = ?, updated_at = datetime('now') WHERE chat_id = ?"
    )
        .bind(tz, chatId)
        .run();
}

// ==================== PAGE SIZE ====================

/**
 * Get page size for a chat (defaults to 5)
 */
export async function getPageSize(env: Env, chatId: string): Promise<number> {
    const result = await env.DB.prepare('SELECT page_size FROM users WHERE chat_id = ?')
        .bind(chatId)
        .first<{ page_size: number | null }>();
    return result?.page_size || 5;
}

/**
 * Set page size for a chat
 */
export async function setPageSize(env: Env, chatId: string, size: number): Promise<void> {
    await env.DB.prepare(
        "UPDATE users SET page_size = ?, updated_at = datetime('now') WHERE chat_id = ?"
    )
        .bind(size, chatId)
        .run();
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
 * Get ALL repos matching owner/repo — returns all rows (multiple users may watch same repo)
 * Used for webhook signature verification (try each row's webhook_secret)
 */
export async function getAllReposByOwnerRepo(
    env: Env,
    owner: string,
    repo: string
): Promise<WatchedRepo[]> {
    const result = await env.DB.prepare('SELECT * FROM repos WHERE owner = ? AND repo = ? AND is_watching = 1')
        .bind(owner, repo)
        .all<WatchedRepo>();
    return result.results || [];
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
        webhook_secret?: string;
        config?: RepoConfig;
    }
): Promise<string> {
    const id = generateId();
    const config = data.config || DEFAULT_REPO_CONFIG;

    await env.DB.prepare(
        `INSERT INTO repos (id, chat_id, owner, repo, config, webhook_id, webhook_secret)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
        .bind(id, chatId, data.owner, data.repo, JSON.stringify(config), data.webhook_id || null, data.webhook_secret || null)
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
        webhook_secret?: string | null;
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
    if (updates.webhook_secret !== undefined) {
        sets.push('webhook_secret = ?');
        values.push(updates.webhook_secret);
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

// ==================== REPO OVERVIEWS ====================

interface RepoOverviewRow {
    id: string;
    repo_id: string;
    summary: string | null;
    tech_stack: string | null;
    key_features: string | null;
    target_audience: string | null;
    brand_voice: string | null;
    visual_theme: string | null;
    recent_changes: string | null;
    version: number;
    created_at: string;
    updated_at: string;
}

function parseOverviewRow(row: RepoOverviewRow): RepoOverview {
    let keyFeatures: string[] = [];
    let recentChanges: string[] = [];
    try {
        keyFeatures = row.key_features ? JSON.parse(row.key_features) : [];
    } catch { /* empty */ }
    try {
        recentChanges = row.recent_changes ? JSON.parse(row.recent_changes) : [];
    } catch { /* empty */ }

    return {
        id: row.id,
        repo_id: row.repo_id,
        summary: row.summary,
        tech_stack: row.tech_stack,
        key_features: keyFeatures,
        target_audience: row.target_audience,
        brand_voice: row.brand_voice,
        visual_theme: row.visual_theme,
        recent_changes: recentChanges,
        version: row.version,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

/**
 * Get repo overview by repo ID.
 * When chatId is provided, verifies repo ownership via repos.chat_id before returning.
 */
export async function getRepoOverview(env: Env, repoId: string, chatId?: string): Promise<RepoOverview | null> {
    if (chatId) {
        // Verify the caller owns this repo
        const repo = await env.DB.prepare('SELECT id FROM repos WHERE id = ? AND chat_id = ?')
            .bind(repoId, chatId)
            .first();
        if (!repo) return null;
    }

    const row = await env.DB.prepare('SELECT * FROM repo_overviews WHERE repo_id = ?')
        .bind(repoId)
        .first<RepoOverviewRow>();
    if (!row) return null;
    return parseOverviewRow(row);
}

/**
 * Insert or replace full overview (used by bootstrap /overview command)
 */
export async function upsertRepoOverview(env: Env, repoId: string, overview: Omit<RepoOverview, 'id' | 'repo_id' | 'version' | 'created_at' | 'updated_at'>): Promise<void> {
    const id = generateId();
    await env.DB.prepare(`
        INSERT INTO repo_overviews (id, repo_id, summary, tech_stack, key_features, target_audience, brand_voice, visual_theme, recent_changes, version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        ON CONFLICT(repo_id) DO UPDATE SET
            summary = excluded.summary,
            tech_stack = excluded.tech_stack,
            key_features = excluded.key_features,
            target_audience = excluded.target_audience,
            brand_voice = excluded.brand_voice,
            visual_theme = excluded.visual_theme,
            recent_changes = excluded.recent_changes,
            version = 1,
            updated_at = datetime('now')
    `)
        .bind(
            id,
            repoId,
            overview.summary || null,
            overview.tech_stack || null,
            JSON.stringify(overview.key_features || []),
            overview.target_audience || null,
            overview.brand_voice || null,
            overview.visual_theme || null,
            JSON.stringify(overview.recent_changes || []),
        )
        .run();
}

/**
 * Apply field-level patches to an existing overview.
 * Reads current, applies patches, enforces 20-item FIFO on recent_changes, increments version.
 */
export async function applyOverviewPatches(env: Env, repoId: string, patches: OverviewPatch): Promise<void> {
    const current = await getRepoOverview(env, repoId);
    if (!current) {
        logInfo('No overview to patch for repo:', repoId);
        return;
    }

    let changed = false;

    // Scalar fields
    if (patches.summary !== undefined && patches.summary !== null) {
        current.summary = patches.summary;
        changed = true;
    }
    if (patches.tech_stack !== undefined && patches.tech_stack !== null) {
        current.tech_stack = patches.tech_stack;
        changed = true;
    }
    if (patches.target_audience !== undefined && patches.target_audience !== null) {
        current.target_audience = patches.target_audience;
        changed = true;
    }
    if (patches.brand_voice !== undefined && patches.brand_voice !== null) {
        current.brand_voice = patches.brand_voice;
        changed = true;
    }
    if (patches.visual_theme !== undefined && patches.visual_theme !== null) {
        current.visual_theme = patches.visual_theme;
        changed = true;
    }

    // Array fields: key_features
    if (patches.key_features && typeof patches.key_features === 'object') {
        const patch = patches.key_features;
        if (Array.isArray(patch.remove) && patch.remove.length > 0) {
            current.key_features = current.key_features.filter(f => !patch.remove.includes(f));
            changed = true;
        }
        if (Array.isArray(patch.add) && patch.add.length > 0) {
            for (const item of patch.add) {
                if (!current.key_features.includes(item)) {
                    current.key_features.push(item);
                }
            }
            // Cap at 10 items
            if (current.key_features.length > 10) {
                current.key_features = current.key_features.slice(-10);
            }
            changed = true;
        }
    }

    // Array fields: recent_changes (FIFO, max 20)
    if (patches.recent_changes && typeof patches.recent_changes === 'object') {
        const patch = patches.recent_changes;
        if (Array.isArray(patch.remove) && patch.remove.length > 0) {
            current.recent_changes = current.recent_changes.filter(c => !patch.remove.includes(c));
            changed = true;
        }
        if (Array.isArray(patch.add) && patch.add.length > 0) {
            current.recent_changes.push(...patch.add);
            // FIFO: keep last 20
            if (current.recent_changes.length > 20) {
                current.recent_changes = current.recent_changes.slice(-20);
            }
            changed = true;
        }
    }

    if (!changed) return;

    await env.DB.prepare(`
        UPDATE repo_overviews SET
            summary = ?,
            tech_stack = ?,
            key_features = ?,
            target_audience = ?,
            brand_voice = ?,
            visual_theme = ?,
            recent_changes = ?,
            version = version + 1,
            updated_at = datetime('now')
        WHERE repo_id = ?
    `)
        .bind(
            current.summary,
            current.tech_stack,
            JSON.stringify(current.key_features),
            current.target_audience,
            current.brand_voice,
            current.visual_theme,
            JSON.stringify(current.recent_changes),
            repoId,
        )
        .run();
}

/**
 * Update a single field of the overview (for manual editing)
 */
export async function updateOverviewField(
    env: Env,
    repoId: string,
    field: string,
    value: string
): Promise<boolean> {
    const allowedFields = ['summary', 'tech_stack', 'key_features', 'target_audience', 'brand_voice', 'visual_theme'];
    if (!allowedFields.includes(field)) return false;

    const result = await env.DB.prepare(
        `UPDATE repo_overviews SET ${field} = ?, version = version + 1, updated_at = datetime('now') WHERE repo_id = ?`
    )
        .bind(value, repoId)
        .run();
    return (result.meta?.changes ?? 0) > 0;
}

// ==================== VIDEO DRAFTS ====================

/**
 * Create a new video draft
 */
export async function createVideoDraft(
    env: Env,
    chatId: string,
    data: {
        repo_id?: string;
        script?: string;
        caption?: string;
        twitter_caption?: string;
        title?: string;
        config?: string;
        reference_sha?: string;
    }
): Promise<string> {
    const id = generateId();
    await env.DB.prepare(
        `INSERT INTO video_drafts (id, chat_id, repo_id, script, caption, twitter_caption, title, config, reference_sha)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
        .bind(
            id, chatId,
            data.repo_id || null,
            data.script || null,
            data.caption || null,
            data.twitter_caption || null,
            data.title || null,
            data.config || null,
            data.reference_sha || null,
        )
        .run();
    return id;
}

/**
 * Get a video draft by ID — verifies ownership
 */
export async function getVideoDraft(env: Env, id: string, chatId: string): Promise<VideoDraft | null> {
    return env.DB.prepare('SELECT * FROM video_drafts WHERE id = ? AND chat_id = ?')
        .bind(id, chatId)
        .first<VideoDraft>();
}

/**
 * Get video drafts by status for a user
 */
export async function getVideoDraftsByStatus(
    env: Env,
    chatId: string,
    status: VideoDraftStatus,
    limit = 5,
    offset = 0
): Promise<VideoDraft[]> {
    const intLimit = Math.max(1, Math.floor(Number(limit) || 5));
    const intOffset = Math.max(0, Math.floor(Number(offset) || 0));
    const result = await env.DB.prepare(
        'SELECT * FROM video_drafts WHERE chat_id = ? AND status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    )
        .bind(String(chatId), String(status), intLimit, intOffset)
        .all<VideoDraft>();
    return result.results || [];
}

/**
 * Get video drafts for a specific repo
 */
export async function getVideoDraftsByRepo(
    env: Env,
    chatId: string,
    repoId: string,
    status?: VideoDraftStatus,
    limit = 5,
    offset = 0
): Promise<VideoDraft[]> {
    // Coerce limit/offset to integers for D1 type safety
    const intLimit = Math.max(1, Math.floor(Number(limit) || 5));
    const intOffset = Math.max(0, Math.floor(Number(offset) || 0));

    if (status) {
        const result = await env.DB.prepare(
            'SELECT * FROM video_drafts WHERE chat_id = ? AND repo_id = ? AND status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
        )
            .bind(String(chatId), String(repoId), String(status), intLimit, intOffset)
            .all<VideoDraft>();
        return result.results || [];
    }
    const result = await env.DB.prepare(
        'SELECT * FROM video_drafts WHERE chat_id = ? AND repo_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    )
        .bind(String(chatId), String(repoId), intLimit, intOffset)
        .all<VideoDraft>();
    return result.results || [];
}

/**
 * Count video drafts by repo and optional status
 */
export async function countVideoDraftsByRepo(
    env: Env,
    chatId: string,
    repoId: string,
    status?: VideoDraftStatus
): Promise<number> {
    if (status) {
        const result = await env.DB.prepare(
            'SELECT COUNT(*) as count FROM video_drafts WHERE chat_id = ? AND repo_id = ? AND status = ?'
        )
            .bind(String(chatId), String(repoId), String(status))
            .first<{ count: number }>();
        return result?.count || 0;
    }
    const result = await env.DB.prepare(
        'SELECT COUNT(*) as count FROM video_drafts WHERE chat_id = ? AND repo_id = ?'
    )
        .bind(String(chatId), String(repoId))
        .first<{ count: number }>();
    return result?.count || 0;
}

/**
 * Update a video draft — verifies ownership
 */
export async function updateVideoDraft(
    env: Env,
    id: string,
    chatId: string,
    updates: Partial<Pick<VideoDraft, 'status' | 'script' | 'caption' | 'twitter_caption' | 'title' | 'config' | 'heygen_video_id' | 'video_url' | 'scheduled_at'>>
): Promise<boolean> {
    const sets: string[] = [];
    const values: (string | null)[] = [];

    for (const [key, val] of Object.entries(updates)) {
        if (val !== undefined) {
            sets.push(`${key} = ?`);
            values.push(val as string | null);
        }
    }

    if (sets.length === 0) return false;

    sets.push("updated_at = datetime('now')");
    values.push(id, chatId);

    const result = await env.DB.prepare(
        `UPDATE video_drafts SET ${sets.join(', ')} WHERE id = ? AND chat_id = ?`
    )
        .bind(...values)
        .run();
    return (result.meta?.changes ?? 0) > 0;
}

/**
 * Delete a video draft — verifies ownership
 */
export async function deleteVideoDraft(env: Env, id: string, chatId: string): Promise<boolean> {
    const result = await env.DB.prepare('DELETE FROM video_drafts WHERE id = ? AND chat_id = ?')
        .bind(id, chatId)
        .run();
    return (result.meta?.changes ?? 0) > 0;
}

/**
 * Get video draft by HeyGen video ID (for webhook callback lookup).
 * INTENTIONALLY UNSCOPED: Called from external HeyGen webhook with opaque UUID.
 * The heygen_video_id is a random UUID that cannot be guessed, providing implicit security.
 */
export async function getVideoDraftByHeygenId(env: Env, heygenVideoId: string): Promise<VideoDraft | null> {
    return env.DB.prepare('SELECT * FROM video_drafts WHERE heygen_video_id = ?')
        .bind(heygenVideoId)
        .first<VideoDraft>();
}

// ==================== VIDEO PUBLISHED ====================

/**
 * Create a video published record
 */
export async function createVideoPublished(
    env: Env,
    chatId: string,
    data: {
        video_draft_id: string;
        repo_id?: string;
        twitter_url?: string;
        instagram_url?: string;
        caption?: string;
    }
): Promise<string> {
    const id = generateId();
    await env.DB.prepare(
        `INSERT INTO video_published (id, chat_id, video_draft_id, repo_id, twitter_url, instagram_url, caption)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
        .bind(id, chatId, data.video_draft_id, data.repo_id || null, data.twitter_url || null, data.instagram_url || null, data.caption || null)
        .run();
    return id;
}

/**
 * Get published videos for a repo
 */
export async function getVideoPublishedByRepo(
    env: Env,
    chatId: string,
    repoId: string,
    limit = 5,
    offset = 0
): Promise<VideoPublished[]> {
    const result = await env.DB.prepare(
        'SELECT * FROM video_published WHERE chat_id = ? AND repo_id = ? ORDER BY published_at DESC LIMIT ? OFFSET ?'
    )
        .bind(chatId, repoId, limit, offset)
        .all<VideoPublished>();
    return result.results || [];
}

// ==================== VIDEO PRESETS ====================

/**
 * Create a video preset
 */
export async function createVideoPreset(env: Env, chatId: string, name: string, config: VideoConfig): Promise<string> {
    const id = generateId();
    await env.DB.prepare(
        'INSERT INTO video_presets (id, chat_id, name, config) VALUES (?, ?, ?, ?)'
    )
        .bind(id, chatId, name, JSON.stringify(config))
        .run();
    return id;
}

/**
 * Get all presets for a user
 */
export async function getVideoPresets(env: Env, chatId: string): Promise<VideoPreset[]> {
    const result = await env.DB.prepare(
        'SELECT * FROM video_presets WHERE chat_id = ? ORDER BY created_at DESC'
    )
        .bind(chatId)
        .all<VideoPreset>();
    return result.results || [];
}

/**
 * Delete a video preset — verifies ownership
 */
export async function deleteVideoPreset(env: Env, id: string, chatId: string): Promise<boolean> {
    const result = await env.DB.prepare('DELETE FROM video_presets WHERE id = ? AND chat_id = ?')
        .bind(id, chatId)
        .run();
    return (result.meta?.changes ?? 0) > 0;
}

// ==================== VIDEO CRON HELPERS ====================

/**
 * Get the most recent published video for a repo (for "since last video" range)
 */
export async function getLastPublishedVideoForRepo(
    env: Env,
    chatId: string,
    repoId: string
): Promise<VideoPublished | null> {
    return env.DB.prepare(
        'SELECT * FROM video_published WHERE chat_id = ? AND repo_id = ? ORDER BY published_at DESC LIMIT 1'
    )
        .bind(chatId, repoId)
        .first<VideoPublished>();
}

/**
 * Get video drafts by status for cron processing (no chat_id filter)
 */
export async function getVideoDraftsByStatusForCron(env: Env, status: VideoDraftStatus): Promise<VideoDraft[]> {
    const result = await env.DB.prepare(
        'SELECT * FROM video_drafts WHERE status = ? ORDER BY created_at ASC'
    )
        .bind(status)
        .all<VideoDraft>();
    return result.results || [];
}

/**
 * Get stale generating drafts (for cron timeout fallback)
 */
export async function getStaleGeneratingDrafts(env: Env, olderThanMinutes: number): Promise<VideoDraft[]> {
    const result = await env.DB.prepare(
        `SELECT * FROM video_drafts WHERE status = 'generating' AND updated_at <= datetime('now', '-' || ? || ' minutes')`
    )
        .bind(olderThanMinutes)
        .all<VideoDraft>();
    return result.results || [];
}

// ==================== VIDEO SETTINGS ====================

/**
 * Get video settings for a chat (characters, looks, defaults)
 */
export async function getVideoSettings(env: Env, chatId: string): Promise<VideoSettings> {
    const { DEFAULT_VIDEO_SETTINGS } = await import('../types');
    try {
        const row = await env.DB.prepare('SELECT video_settings FROM users WHERE chat_id = ?')
            .bind(chatId)
            .first<{ video_settings: string | null }>();
        if (row?.video_settings) {
            return { ...DEFAULT_VIDEO_SETTINGS, ...JSON.parse(row.video_settings) };
        }
    } catch {
        // Column may not exist yet
    }
    return DEFAULT_VIDEO_SETTINGS;
}

/**
 * Update video settings for a chat
 */
export async function updateVideoSettings(env: Env, chatId: string, settings: VideoSettings): Promise<void> {
    await env.DB.prepare(
        `UPDATE users SET video_settings = ?, updated_at = datetime('now') WHERE chat_id = ?`
    )
        .bind(JSON.stringify(settings), chatId)
        .run();
}

// ==================== TWITTER ACCOUNTS ====================

/**
 * Create a new Twitter account to follow
 */
export async function createTwitterAccount(
    env: Env,
    chatId: string,
    data: {
        username: string;
        user_id?: string;
        display_name?: string;
        config?: TwitterAccountConfig;
    }
): Promise<string> {
    const id = generateId();
    const config = data.config || DEFAULT_TWITTER_ACCOUNT_CONFIG;

    await env.DB.prepare(
        `INSERT INTO twitter_accounts (id, chat_id, username, user_id, display_name, config)
         VALUES (?, ?, ?, ?, ?, ?)`
    )
        .bind(id, chatId, data.username, data.user_id || null, data.display_name || null, JSON.stringify(config))
        .run();

    return id;
}

/**
 * Get all Twitter accounts for a user
 */
export async function getTwitterAccounts(env: Env, chatId: string): Promise<TwitterAccount[]> {
    const result = await env.DB.prepare(
        'SELECT * FROM twitter_accounts WHERE chat_id = ? ORDER BY created_at DESC'
    )
        .bind(chatId)
        .all<TwitterAccount>();
    return result.results || [];
}

/**
 * Get a single Twitter account by ID - verifies ownership
 */
export async function getTwitterAccount(env: Env, accountId: string, chatId: string): Promise<TwitterAccount | null> {
    return env.DB.prepare('SELECT * FROM twitter_accounts WHERE id = ? AND chat_id = ?')
        .bind(accountId, chatId)
        .first<TwitterAccount>();
}

/**
 * Update a Twitter account - verifies ownership
 */
export async function updateTwitterAccount(
    env: Env,
    accountId: string,
    chatId: string,
    updates: {
        is_watching?: number;
        config?: TwitterAccountConfig;
        last_tweet_id?: string | null;
        thread_buffer?: string | null;
        user_id?: string;
        display_name?: string;
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
    if (updates.last_tweet_id !== undefined) {
        sets.push('last_tweet_id = ?');
        values.push(updates.last_tweet_id);
    }
    if (updates.thread_buffer !== undefined) {
        sets.push('thread_buffer = ?');
        values.push(updates.thread_buffer);
    }
    if (updates.user_id !== undefined) {
        sets.push('user_id = ?');
        values.push(updates.user_id);
    }
    if (updates.display_name !== undefined) {
        sets.push('display_name = ?');
        values.push(updates.display_name);
    }

    if (sets.length === 0) return false;

    sets.push("updated_at = datetime('now')");
    values.push(accountId, chatId);

    const result = await env.DB.prepare(
        `UPDATE twitter_accounts SET ${sets.join(', ')} WHERE id = ? AND chat_id = ?`
    )
        .bind(...values)
        .run();
    return (result.meta?.changes ?? 0) > 0;
}

/**
 * Delete a Twitter account and all related data - verifies ownership
 */
export async function deleteTwitterAccount(env: Env, accountId: string, chatId: string): Promise<boolean> {
    // Delete related tweets and overview first
    await env.DB.prepare('DELETE FROM twitter_tweets WHERE account_id = ? AND chat_id = ?')
        .bind(accountId, chatId)
        .run();
    await env.DB.prepare('DELETE FROM twitter_account_overviews WHERE account_id = ?')
        .bind(accountId)
        .run();

    const result = await env.DB.prepare('DELETE FROM twitter_accounts WHERE id = ? AND chat_id = ?')
        .bind(accountId, chatId)
        .run();
    return (result.meta?.changes ?? 0) > 0;
}

/**
 * Get all watching Twitter accounts (no chatId filter — for coordinator query)
 * SECURITY: Only use in cron coordinator context
 */
export async function getWatchingTwitterAccounts(env: Env): Promise<TwitterAccount[]> {
    const result = await env.DB.prepare(
        'SELECT * FROM twitter_accounts WHERE is_watching = 1 ORDER BY created_at DESC'
    ).all<TwitterAccount>();
    return result.results || [];
}

/**
 * Get watching Twitter accounts for a specific user (for per-user poller fan-out)
 */
export async function getWatchingTwitterAccountsByUser(env: Env, chatId: string): Promise<TwitterAccount[]> {
    const result = await env.DB.prepare(
        'SELECT * FROM twitter_accounts WHERE chat_id = ? AND is_watching = 1 ORDER BY created_at DESC'
    )
        .bind(chatId)
        .all<TwitterAccount>();
    return result.results || [];
}

// ==================== TWITTER ACCOUNT OVERVIEWS ====================

/**
 * Get persona overview for a Twitter account — verifies account ownership
 */
export async function getTwitterAccountOverview(env: Env, chatId: string, accountId: string): Promise<TwitterAccountOverview | null> {
    // Verify the caller owns this account
    const account = await env.DB.prepare('SELECT id FROM twitter_accounts WHERE id = ? AND chat_id = ?')
        .bind(accountId, chatId)
        .first();
    if (!account) return null;

    return env.DB.prepare('SELECT * FROM twitter_account_overviews WHERE account_id = ?')
        .bind(accountId)
        .first<TwitterAccountOverview>();
}

/**
 * Create or update persona overview for a Twitter account
 */
export async function upsertTwitterAccountOverview(
    env: Env,
    accountId: string,
    data: {
        persona?: string | null;
        topics?: string | null;
        communication_style?: string | null;
        notable_context?: string | null;
        recent_themes?: string | null;
    }
): Promise<void> {
    // Direct query (no ownership check) — callers must verify ownership before calling
    const existing = await env.DB.prepare('SELECT * FROM twitter_account_overviews WHERE account_id = ?')
        .bind(accountId)
        .first<TwitterAccountOverview>();

    if (existing) {
        const sets: string[] = [];
        const values: (string | number | null)[] = [];

        if (data.persona !== undefined) { sets.push('persona = ?'); values.push(data.persona); }
        if (data.topics !== undefined) { sets.push('topics = ?'); values.push(data.topics); }
        if (data.communication_style !== undefined) { sets.push('communication_style = ?'); values.push(data.communication_style); }
        if (data.notable_context !== undefined) { sets.push('notable_context = ?'); values.push(data.notable_context); }
        if (data.recent_themes !== undefined) { sets.push('recent_themes = ?'); values.push(data.recent_themes); }

        if (sets.length === 0) return;

        sets.push('version = version + 1');
        sets.push("updated_at = datetime('now')");
        values.push(accountId);

        await env.DB.prepare(
            `UPDATE twitter_account_overviews SET ${sets.join(', ')} WHERE account_id = ?`
        )
            .bind(...values)
            .run();
    } else {
        const id = generateId();
        await env.DB.prepare(
            `INSERT INTO twitter_account_overviews (id, account_id, persona, topics, communication_style, notable_context, recent_themes)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
            .bind(
                id, accountId,
                data.persona || null, data.topics || null,
                data.communication_style || null, data.notable_context || null,
                data.recent_themes || null
            )
            .run();
    }
}

// ==================== TWITTER TWEETS ====================

/**
 * Get a tweet by ID — verifies ownership via chat_id
 */
export async function getTwitterTweet(env: Env, chatId: string, tweetId: string): Promise<TwitterTweet | null> {
    return env.DB.prepare('SELECT * FROM twitter_tweets WHERE id = ? AND chat_id = ?')
        .bind(tweetId, chatId)
        .first<TwitterTweet>();
}

/**
 * Create a tweet record
 */
export async function createTwitterTweet(
    env: Env,
    data: {
        id: string; // Tweet ID from X
        account_id: string;
        chat_id: string;
        conversation_id?: string | null;
        thread_position?: number;
        is_thread?: number;
        text: string;
        author_username: string;
        metrics?: string | null;
        tweet_url?: string | null;
        tweeted_at?: string | null;
        status?: string;
        media_url?: string | null;
    }
): Promise<void> {
    await env.DB.prepare(
        `INSERT OR IGNORE INTO twitter_tweets (id, account_id, chat_id, conversation_id, thread_position, is_thread, text, author_username, metrics, tweet_url, tweeted_at, status, media_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
        .bind(
            data.id, data.account_id, data.chat_id,
            data.conversation_id || null, data.thread_position || 0, data.is_thread || 0,
            data.text, data.author_username,
            data.metrics || null, data.tweet_url || null, data.tweeted_at || null,
            data.status || 'pending',
            data.media_url || null
        )
        .run();
}

/**
 * Update a tweet record
 */
export async function updateTwitterTweet(
    env: Env,
    tweetId: string,
    updates: {
        relevance_score?: number | null;
        relevance_reason?: string | null;
        status?: string;
        draft_id?: string | null;
        batch_message_id?: number | null;
        thread_position?: number;
        is_thread?: number;
        text?: string;
    }
): Promise<boolean> {
    const sets: string[] = [];
    const values: (string | number | null)[] = [];

    if (updates.relevance_score !== undefined) { sets.push('relevance_score = ?'); values.push(updates.relevance_score); }
    if (updates.relevance_reason !== undefined) { sets.push('relevance_reason = ?'); values.push(updates.relevance_reason); }
    if (updates.status !== undefined) { sets.push('status = ?'); values.push(updates.status); }
    if (updates.draft_id !== undefined) { sets.push('draft_id = ?'); values.push(updates.draft_id); }
    if (updates.batch_message_id !== undefined) { sets.push('batch_message_id = ?'); values.push(updates.batch_message_id); }
    if (updates.thread_position !== undefined) { sets.push('thread_position = ?'); values.push(updates.thread_position); }
    if (updates.is_thread !== undefined) { sets.push('is_thread = ?'); values.push(updates.is_thread); }
    if (updates.text !== undefined) { sets.push('text = ?'); values.push(updates.text); }

    if (sets.length === 0) return false;

    values.push(tweetId);

    const result = await env.DB.prepare(
        `UPDATE twitter_tweets SET ${sets.join(', ')} WHERE id = ?`
    )
        .bind(...values)
        .run();
    return (result.meta?.changes ?? 0) > 0;
}

/**
 * Get pending tweets for an account (for scoring pipeline)
 */
export async function getPendingTweetsByAccount(env: Env, accountId: string): Promise<TwitterTweet[]> {
    const result = await env.DB.prepare(
        "SELECT * FROM twitter_tweets WHERE account_id = ? AND status = 'pending' ORDER BY created_at ASC"
    )
        .bind(accountId)
        .all<TwitterTweet>();
    return result.results || [];
}

/**
 * Get recent tweets by account — for persona context (last N tweets)
 * Verifies account ownership via twitter_accounts.chat_id before querying.
 */
export async function getRecentTweetsByAccount(env: Env, chatId: string, accountId: string, limit = 50): Promise<TwitterTweet[]> {
    // Verify the caller owns this account
    const account = await env.DB.prepare('SELECT id FROM twitter_accounts WHERE id = ? AND chat_id = ?')
        .bind(accountId, chatId)
        .first();
    if (!account) return [];

    const result = await env.DB.prepare(
        'SELECT * FROM twitter_tweets WHERE account_id = ? AND chat_id = ? ORDER BY created_at DESC LIMIT ?'
    )
        .bind(accountId, chatId, limit)
        .all<TwitterTweet>();
    return result.results || [];
}

/**
 * Get scored tweets by batch message ID — for batch message reconstruction
 */
export async function getScoredTweetsByBatchMessage(env: Env, chatId: string, batchMessageId: number): Promise<TwitterTweet[]> {
    const result = await env.DB.prepare(
        'SELECT * FROM twitter_tweets WHERE batch_message_id = ? AND chat_id = ? ORDER BY relevance_score DESC'
    )
        .bind(batchMessageId, chatId)
        .all<TwitterTweet>();
    return result.results || [];
}

/**
 * Parse config from Twitter account record
 */
export function parseTwitterAccountConfig(account: TwitterAccount): TwitterAccountConfig {
    try {
        return JSON.parse(account.config) as TwitterAccountConfig;
    } catch {
        return DEFAULT_TWITTER_ACCOUNT_CONFIG;
    }
}

// ==================== PERSONA CACHE ====================

/**
 * Get cached persona for a username
 */
export async function getPersonaCache(env: Env, username: string): Promise<PersonaCache | null> {
    return env.DB.prepare('SELECT * FROM persona_cache WHERE username = ?')
        .bind(username.toLowerCase())
        .first<PersonaCache>();
}

/**
 * Upsert persona cache entry
 */
export async function upsertPersonaCache(
    env: Env,
    username: string,
    data: { user_id?: string; display_name?: string; bio?: string; persona?: string; topics?: string }
): Promise<void> {
    const existing = await getPersonaCache(env, username);
    if (existing) {
        const sets: string[] = ["updated_at = datetime('now')"];
        const values: (string | null)[] = [];
        if (data.user_id !== undefined) { sets.push('user_id = ?'); values.push(data.user_id); }
        if (data.display_name !== undefined) { sets.push('display_name = ?'); values.push(data.display_name); }
        if (data.bio !== undefined) { sets.push('bio = ?'); values.push(data.bio); }
        if (data.persona !== undefined) { sets.push('persona = ?'); values.push(data.persona); }
        if (data.topics !== undefined) { sets.push('topics = ?'); values.push(data.topics); }
        values.push(existing.id);
        await env.DB.prepare(`UPDATE persona_cache SET ${sets.join(', ')} WHERE id = ?`)
            .bind(...values)
            .run();
    } else {
        const id = generateId();
        await env.DB.prepare(
            `INSERT INTO persona_cache (id, username, user_id, display_name, bio, persona, topics)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
            .bind(id, username.toLowerCase(), data.user_id || null, data.display_name || null, data.bio || null, data.persona || null, data.topics || null)
            .run();
    }
}

/**
 * Check if a repost draft already exists for a tweet ID
 */
export async function getExistingRepostDraft(env: Env, chatId: string, tweetId: string): Promise<Draft | null> {
    return env.DB.prepare(
        "SELECT * FROM drafts WHERE chat_id = ? AND source = 'repost' AND original_tweet_id = ? LIMIT 1"
    )
        .bind(chatId, tweetId)
        .first<Draft>();
}
