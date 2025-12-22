/**
 * Database operations for D1.
 */

import type { Env } from '../index';

export interface Draft {
    id: string;
    project_id: string;
    status: 'draft' | 'approved' | 'rejected' | 'published';
    content: string; // JSON
    source: string;  // JSON
    telegram_message_id: number | null;
    created_at: string;
    updated_at: string;
}

export interface ChatState {
    chat_id: string;
    dashboard_message_id: number | null;
    current_view: string;
    selected_draft_id: string | null;
    awaiting_input: string | null;
    context: string | null;
}

export interface Published {
    id: string;
    draft_id: string;
    project_id: string;
    tweet_ids: string; // JSON array
    tweet_url: string | null;
    published_at: string;
}

/**
 * Get chat state, creating if not exists.
 */
export async function getChatState(env: Env, chatId: string): Promise<ChatState> {
    const result = await env.DB.prepare(
        'SELECT * FROM chat_state WHERE chat_id = ?'
    ).bind(chatId).first<ChatState>();

    if (result) return result;

    // Create new state
    await env.DB.prepare(
        'INSERT INTO chat_state (chat_id) VALUES (?)'
    ).bind(chatId).run();

    return {
        chat_id: chatId,
        dashboard_message_id: null,
        current_view: 'home',
        selected_draft_id: null,
        awaiting_input: null,
        context: null,
    };
}

/**
 * Update chat state.
 */
export async function updateChatState(
    env: Env,
    chatId: string,
    updates: Partial<ChatState>
): Promise<void> {
    const sets: string[] = [];
    const values: (string | number | null)[] = [];

    if (updates.dashboard_message_id !== undefined) {
        sets.push('dashboard_message_id = ?');
        values.push(updates.dashboard_message_id);
    }
    if (updates.current_view !== undefined) {
        sets.push('current_view = ?');
        values.push(updates.current_view);
    }
    if (updates.selected_draft_id !== undefined) {
        sets.push('selected_draft_id = ?');
        values.push(updates.selected_draft_id);
    }
    if (updates.awaiting_input !== undefined) {
        sets.push('awaiting_input = ?');
        values.push(updates.awaiting_input);
    }

    sets.push("updated_at = datetime('now')");
    values.push(chatId);

    await env.DB.prepare(
        `UPDATE chat_state SET ${sets.join(', ')} WHERE chat_id = ?`
    ).bind(...values).run();
}

/**
 * Get drafts by status.
 */
export async function getDraftsByStatus(
    env: Env,
    status: string
): Promise<Draft[]> {
    const result = await env.DB.prepare(
        'SELECT * FROM drafts WHERE status = ? ORDER BY created_at DESC LIMIT 20'
    ).bind(status).all<Draft>();

    return result.results || [];
}

/**
 * Get a single draft.
 */
export async function getDraft(env: Env, id: string): Promise<Draft | null> {
    return env.DB.prepare(
        'SELECT * FROM drafts WHERE id = ?'
    ).bind(id).first<Draft>();
}

/**
 * Update draft status.
 */
export async function updateDraftStatus(
    env: Env,
    id: string,
    status: string
): Promise<void> {
    await env.DB.prepare(
        "UPDATE drafts SET status = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(status, id).run();
}

/**
 * Get stats.
 */
export async function getStats(env: Env): Promise<{
    pending: number;
    approved: number;
    published: number;
    rejected: number;
    publishedToday: number;
}> {
    const [pending, approved, published, rejected, today] = await Promise.all([
        env.DB.prepare("SELECT COUNT(*) as c FROM drafts WHERE status = 'draft'").first<{ c: number }>(),
        env.DB.prepare("SELECT COUNT(*) as c FROM drafts WHERE status = 'approved'").first<{ c: number }>(),
        env.DB.prepare("SELECT COUNT(*) as c FROM published").first<{ c: number }>(),
        env.DB.prepare("SELECT COUNT(*) as c FROM drafts WHERE status = 'rejected'").first<{ c: number }>(),
        env.DB.prepare("SELECT COUNT(*) as c FROM published WHERE date(published_at) = date('now')").first<{ c: number }>(),
    ]);

    return {
        pending: pending?.c || 0,
        approved: approved?.c || 0,
        published: published?.c || 0,
        rejected: rejected?.c || 0,
        publishedToday: today?.c || 0,
    };
}
