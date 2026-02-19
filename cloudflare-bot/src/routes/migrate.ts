import type { Env } from '../types';
import { verifyAdminSecret, secureJsonResponse, secureErrorResponse, sanitizeError, logInfo, logError } from '../services/security';

/**
 * Helper: run each SQL statement individually using prepare().run() to avoid D1 exec() issues
 */
async function execStatements(db: Env['DB'], statements: string[]): Promise<void> {
    for (const stmt of statements) {
        const trimmed = stmt.trim();
        if (trimmed) await db.prepare(trimmed).run();
    }
}

export async function handleMigrate(request: Request, env: Env): Promise<Response> {
    if (!await verifyAdminSecret(request, env)) {
        return secureJsonResponse({ error: 'Unauthorized' }, 401);
    }

    try {
        // Core tables
        await execStatements(env.DB, [
            `CREATE TABLE IF NOT EXISTS drafts (
                id TEXT PRIMARY KEY,
                chat_id TEXT NOT NULL,
                pr_number INTEGER NOT NULL,
                pr_title TEXT NOT NULL,
                commit_sha TEXT NOT NULL,
                status TEXT DEFAULT 'draft',
                content TEXT NOT NULL,
                image_url TEXT,
                scheduled_at TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            );`,
            `CREATE TABLE IF NOT EXISTS chat_state (
                chat_id TEXT PRIMARY KEY,
                message_id INTEGER,
                current_view TEXT DEFAULT 'home',
                context TEXT,
                updated_at TEXT DEFAULT (datetime('now'))
            );`,
            `CREATE TABLE IF NOT EXISTS published (
                id TEXT PRIMARY KEY,
                chat_id TEXT NOT NULL,
                draft_id TEXT NOT NULL,
                pr_number INTEGER NOT NULL,
                tweet_ids TEXT NOT NULL,
                tweet_url TEXT,
                image_url TEXT,
                published_at TEXT DEFAULT (datetime('now'))
            );`,
            `CREATE TABLE IF NOT EXISTS repos (
                id TEXT PRIMARY KEY,
                chat_id TEXT NOT NULL,
                owner TEXT NOT NULL,
                repo TEXT NOT NULL,
                is_watching INTEGER DEFAULT 1,
                config TEXT NOT NULL,
                webhook_id TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                UNIQUE(chat_id, owner, repo)
            );`,
            `CREATE INDEX IF NOT EXISTS idx_drafts_status ON drafts(status);`,
            `CREATE INDEX IF NOT EXISTS idx_drafts_chat_id ON drafts(chat_id);`,
            `CREATE INDEX IF NOT EXISTS idx_drafts_pr ON drafts(pr_number);`,
            `CREATE INDEX IF NOT EXISTS idx_published_pr ON published(pr_number);`,
            `CREATE INDEX IF NOT EXISTS idx_published_chat_id ON published(chat_id);`,
            `CREATE INDEX IF NOT EXISTS idx_repos_watching ON repos(is_watching);`,
            `CREATE INDEX IF NOT EXISTS idx_repos_chat_id ON repos(chat_id);`,
        ]);

        // Migration: Add chat_id columns if missing (legacy)
        try {
            const draftsInfo = await env.DB.prepare("PRAGMA table_info(drafts)").all();
            const hasChatId = draftsInfo.results?.some((col: any) => col.name === 'chat_id');

            if (!hasChatId) {
                await execStatements(env.DB, [
                    `ALTER TABLE drafts ADD COLUMN chat_id TEXT;`,
                    `ALTER TABLE published ADD COLUMN chat_id TEXT;`,
                    `ALTER TABLE repos ADD COLUMN chat_id TEXT;`,
                ]);

                const chatId = env.TELEGRAM_CHAT_ID;
                await env.DB.prepare('UPDATE drafts SET chat_id = ? WHERE chat_id IS NULL').bind(chatId).run();
                await env.DB.prepare('UPDATE published SET chat_id = ? WHERE chat_id IS NULL').bind(chatId).run();
                await env.DB.prepare('UPDATE repos SET chat_id = ? WHERE chat_id IS NULL').bind(chatId).run();

                return secureJsonResponse({ success: true, message: 'Database migrated with chat_id columns added' });
            }
        } catch (migrationError) {
            logInfo('Migration note:', String(migrationError));
        }

        // Migration: Add timezone column to chat_state
        try {
            const chatStateInfo = await env.DB.prepare("PRAGMA table_info(chat_state)").all();
            const hasTimezone = chatStateInfo.results?.some((col: any) => col.name === 'timezone');

            if (!hasTimezone) {
                await env.DB.prepare(`ALTER TABLE chat_state ADD COLUMN timezone TEXT DEFAULT 'UTC';`).run();
                logInfo('Added timezone column to chat_state table');
            }
        } catch (timezoneError) {
            logInfo('Timezone migration note:', String(timezoneError));
        }

        // Migration: Add source column to drafts
        try {
            const draftsInfo2 = await env.DB.prepare("PRAGMA table_info(drafts)").all();
            const hasSource = draftsInfo2.results?.some((col: any) => col.name === 'source');

            if (!hasSource) {
                await env.DB.prepare(`ALTER TABLE drafts ADD COLUMN source TEXT DEFAULT 'auto';`).run();
                logInfo('Added source column to drafts table');
            }
        } catch (sourceError) {
            logInfo('Source migration note:', String(sourceError));
        }

        // Migration: Add page_size column to chat_state
        try {
            const chatStateInfo3 = await env.DB.prepare("PRAGMA table_info(chat_state)").all();
            const hasPageSize = chatStateInfo3.results?.some((col: any) => col.name === 'page_size');

            if (!hasPageSize) {
                await env.DB.prepare(`ALTER TABLE chat_state ADD COLUMN page_size INTEGER DEFAULT 5;`).run();
                logInfo('Added page_size column to chat_state table');
            }
        } catch (pageSizeError) {
            logInfo('Page size migration note:', String(pageSizeError));
        }

        // Repo overviews table
        try {
            await env.DB.prepare(`CREATE TABLE IF NOT EXISTS repo_overviews (
                id TEXT PRIMARY KEY,
                repo_id TEXT NOT NULL UNIQUE,
                summary TEXT,
                tech_stack TEXT,
                key_features TEXT,
                target_audience TEXT,
                brand_voice TEXT,
                visual_theme TEXT,
                recent_changes TEXT,
                version INTEGER DEFAULT 1,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            );`).run();
            logInfo('Ensured repo_overviews table exists');
        } catch (overviewError) {
            logInfo('Repo overviews migration note:', String(overviewError));
        }

        // Video tables
        try {
            await execStatements(env.DB, [
                `CREATE TABLE IF NOT EXISTS video_drafts (
                    id TEXT PRIMARY KEY,
                    chat_id TEXT NOT NULL,
                    repo_id TEXT,
                    status TEXT DEFAULT 'draft',
                    script TEXT,
                    caption TEXT,
                    twitter_caption TEXT,
                    title TEXT,
                    config TEXT,
                    heygen_video_id TEXT,
                    video_url TEXT,
                    reference_sha TEXT,
                    scheduled_at TEXT,
                    created_at TEXT DEFAULT (datetime('now')),
                    updated_at TEXT DEFAULT (datetime('now'))
                );`,
                `CREATE TABLE IF NOT EXISTS video_published (
                    id TEXT PRIMARY KEY,
                    chat_id TEXT NOT NULL,
                    video_draft_id TEXT NOT NULL,
                    repo_id TEXT,
                    twitter_url TEXT,
                    instagram_url TEXT,
                    caption TEXT,
                    published_at TEXT DEFAULT (datetime('now'))
                );`,
                `CREATE TABLE IF NOT EXISTS video_presets (
                    id TEXT PRIMARY KEY,
                    chat_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    config TEXT NOT NULL,
                    created_at TEXT DEFAULT (datetime('now'))
                );`,
                `CREATE INDEX IF NOT EXISTS idx_video_drafts_status ON video_drafts(status);`,
                `CREATE INDEX IF NOT EXISTS idx_video_drafts_heygen ON video_drafts(heygen_video_id);`,
                `CREATE INDEX IF NOT EXISTS idx_video_drafts_chat ON video_drafts(chat_id);`,
                `CREATE INDEX IF NOT EXISTS idx_video_published_chat ON video_published(chat_id);`,
                `CREATE INDEX IF NOT EXISTS idx_video_presets_chat ON video_presets(chat_id);`,
            ]);
            logInfo('Ensured video tables exist');
        } catch (videoError) {
            logInfo('Video tables migration note:', String(videoError));
        }

        // Migration: Add video_settings column to chat_state
        try {
            const chatStateInfo4 = await env.DB.prepare("PRAGMA table_info(chat_state)").all();
            const hasVideoSettings = chatStateInfo4.results?.some((col: any) => col.name === 'video_settings');

            if (!hasVideoSettings) {
                await env.DB.prepare(`ALTER TABLE chat_state ADD COLUMN video_settings TEXT;`).run();
                logInfo('Added video_settings column to chat_state table');
            }
        } catch (videoSettingsError) {
            logInfo('Video settings migration note:', String(videoSettingsError));
        }

        // Migration: Create users table and migrate chat_state data
        try {
            const usersCheck = await env.DB.prepare(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
            ).first();

            if (!usersCheck) {
                await execStatements(env.DB, [
                    `CREATE TABLE IF NOT EXISTS users (
                        chat_id TEXT PRIMARY KEY,
                        username TEXT,
                        display_name TEXT,
                        status TEXT DEFAULT 'onboarding',
                        onboarding_step TEXT,
                        gemini_key_enc TEXT,
                        x_api_key_enc TEXT,
                        x_api_secret_enc TEXT,
                        x_access_token_enc TEXT,
                        x_access_secret_enc TEXT,
                        github_token_enc TEXT,
                        heygen_api_key_enc TEXT,
                        has_gemini INTEGER DEFAULT 0,
                        has_x INTEGER DEFAULT 0,
                        has_github INTEGER DEFAULT 0,
                        has_heygen INTEGER DEFAULT 0,
                        message_id INTEGER,
                        current_view TEXT DEFAULT 'home',
                        context TEXT,
                        timezone TEXT DEFAULT 'UTC',
                        page_size INTEGER DEFAULT 5,
                        video_settings TEXT,
                        daily_generates INTEGER DEFAULT 0,
                        daily_reposts INTEGER DEFAULT 0,
                        last_reset_date TEXT,
                        consecutive_failures INTEGER DEFAULT 0,
                        created_at TEXT DEFAULT (datetime('now')),
                        last_active_at TEXT,
                        updated_at TEXT DEFAULT (datetime('now'))
                    );`,
                    `CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);`,
                ]);
                logInfo('Created users table');

                // Migrate chat_state data into users table
                try {
                    const chatStateCheck = await env.DB.prepare(
                        "SELECT name FROM sqlite_master WHERE type='table' AND name='chat_state'"
                    ).first();

                    if (chatStateCheck) {
                        const chatStateRows = await env.DB.prepare('SELECT * FROM chat_state').all();
                        for (const row of chatStateRows.results || []) {
                            const r = row as any;
                            await env.DB.prepare(`
                                INSERT OR IGNORE INTO users (chat_id, message_id, current_view, context, timezone, page_size, video_settings, status)
                                VALUES (?, ?, ?, ?, ?, ?, ?, 'onboarding')
                            `).bind(
                                r.chat_id,
                                r.message_id || null,
                                r.current_view || 'home',
                                r.context || null,
                                r.timezone || 'UTC',
                                r.page_size || 5,
                                r.video_settings || null
                            ).run();
                            logInfo(`Migrated chat_state for chat_id: ${r.chat_id}`);
                        }

                        await env.DB.prepare('DROP TABLE IF EXISTS chat_state;').run();
                        logInfo('Dropped chat_state table after migration to users');
                    }
                } catch (chatStateMigrationError) {
                    logInfo('chat_state migration note:', String(chatStateMigrationError));
                }
            } else {
                logInfo('Users table already exists, skipping migration');
            }
        } catch (usersError) {
            logInfo('Users table migration note:', String(usersError));
        }

        // Migration: Add webhook_secret column to repos table
        try {
            const reposInfo = await env.DB.prepare("PRAGMA table_info(repos)").all();
            const hasWebhookSecret = reposInfo.results?.some((col: any) => col.name === 'webhook_secret');

            if (!hasWebhookSecret) {
                await env.DB.prepare(`ALTER TABLE repos ADD COLUMN webhook_secret TEXT;`).run();
                logInfo('Added webhook_secret column to repos table');
            }
        } catch (webhookSecretError) {
            logInfo('webhook_secret migration note:', String(webhookSecretError));
        }

        // Migration: Add original_tweet columns to drafts
        try {
            const draftsInfo3 = await env.DB.prepare("PRAGMA table_info(drafts)").all();
            const hasOriginalTweetId = draftsInfo3.results?.some((col: any) => col.name === 'original_tweet_id');

            if (!hasOriginalTweetId) {
                await execStatements(env.DB, [
                    `ALTER TABLE drafts ADD COLUMN original_tweet_id TEXT;`,
                    `ALTER TABLE drafts ADD COLUMN original_tweet_url TEXT;`,
                ]);
                logInfo('Added original_tweet columns to drafts table');
            }
        } catch (tweetColError) {
            logInfo('Original tweet columns migration note:', String(tweetColError));
        }

        // Migration: Add Instagram columns to users table
        try {
            const usersInfo = await env.DB.prepare("PRAGMA table_info(users)").all();
            const hasInstagramToken = usersInfo.results?.some((col: any) => col.name === 'instagram_token_enc');

            if (!hasInstagramToken) {
                await execStatements(env.DB, [
                    `ALTER TABLE users ADD COLUMN instagram_token_enc TEXT;`,
                    `ALTER TABLE users ADD COLUMN instagram_account_id_enc TEXT;`,
                    `ALTER TABLE users ADD COLUMN has_instagram INTEGER DEFAULT 0;`,
                ]);
                logInfo('Added Instagram columns to users table');
            }
        } catch (instagramError) {
            logInfo('Instagram migration note:', String(instagramError));
        }

        return secureJsonResponse({ success: true, message: 'Database migrated' });
    } catch (error) {
        const sanitized = sanitizeError(error);
        logError('Migration error:', error instanceof Error ? error.message : String(error));
        return secureErrorResponse(sanitized, 500);
    }
}
