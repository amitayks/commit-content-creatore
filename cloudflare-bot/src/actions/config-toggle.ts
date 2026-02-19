import type { HandlerContext } from '../core/router';
import type { ViewResult } from '../types';
import { getRepo, updateRepo, parseRepoConfig, setTimezone, getTimezone, setPageSize, getPageSize, updateChatState, getRepoOverview } from '../services/db';
import { renderRepoDetail, renderError, renderSettings } from '../views';
import { isValidTimezone } from '../services/timezone';

export async function configToggleAction(ctx: HandlerContext & { value: string; extra?: string }): Promise<ViewResult | void> {
    const { env, chatId, value: setting, extra } = ctx;

    // Handle page size configuration: config:page_size:N
    if (setting === 'page_size') {
        const size = parseInt(extra || '5', 10);
        const validSizes = [5, 10, 15, 20];
        if (validSizes.includes(size)) {
            await setPageSize(env, chatId, size);
        }
        const tz = await getTimezone(env, chatId);
        const ps = await getPageSize(env, chatId);
        return renderSettings(tz, ps);
    }

    // Handle timezone configuration: config:timezone:OFFSET
    if (setting === 'timezone') {
        if (extra === 'custom') {
            // Prompt user to type a custom offset
            await updateChatState(env, chatId, {
                current_view: 'timezone_input',
                context: { awaiting_input: 'timezone' },
            });
            return {
                text: `⌨️ <b>Custom Timezone</b>\n\nType your UTC offset:\n\nExamples: <code>UTC+2</code>, <code>UTC-5:30</code>, <code>UTC+9:45</code>`,
                keyboard: [[{ text: '❌ Cancel', callback_data: 'view:settings' }]],
            };
        }

        // Preset offset — extra is the offset value (e.g., 'UTC+2', 'UTC-5')
        // Reconstruct full offset: for 'config:timezone:UTC+5:30', value='timezone', extra='UTC+5'
        // But callback_data splits on ':', so 'config:timezone:UTC+5:30' → parts=['config','timezone','UTC+5','30']
        // We need to handle this in the callback parser. For now, presets without ':' in the offset work fine.
        // The extra already contains the offset like 'UTC+2' or 'UTC-5'
        const offset = extra || 'UTC';
        if (isValidTimezone(offset)) {
            await setTimezone(env, chatId, offset);
            const tz = await getTimezone(env, chatId);
            const ps = await getPageSize(env, chatId);
            return renderSettings(tz, ps);
        }

        return renderError('Invalid timezone format. Use UTC+N or UTC-N format.');
    }

    // Handle overview re-bootstrap: config:rebootstrap:REPO_ID
    if (setting === 'rebootstrap') {
        const { overviewCommand } = await import('../commands/overview');
        await overviewCommand({ env, chatId, args: extra });
        return;
    }

    // Handle overview edit: config:edit_overview:REPO_ID
    if (setting === 'edit_overview') {
        const overview = await getRepoOverview(env, extra!, chatId);
        if (!overview) {
            return renderError('No overview found. Bootstrap one first.');
        }
        // Short field codes to stay under Telegram's 64-byte callback_data limit
        return {
            text: `✏️ <b>Edit Overview</b>\n\nSelect a field to edit:`,
            keyboard: [
                [{ text: '📋 Summary', callback_data: `config:ov_edit:${extra}:s` }],
                [{ text: '🛠 Tech Stack', callback_data: `config:ov_edit:${extra}:ts` }],
                [{ text: '⭐ Key Features', callback_data: `config:ov_edit:${extra}:kf` }],
                [{ text: '👥 Target Audience', callback_data: `config:ov_edit:${extra}:ta` }],
                [{ text: '🎤 Brand Voice', callback_data: `config:ov_edit:${extra}:bv` }],
                [{ text: '🎨 Visual Theme', callback_data: `config:ov_edit:${extra}:vt` }],
                [{ text: '◀️ Back', callback_data: `repo:${extra}` }],
            ],
        };
    }

    // Handle overview field edit prompt: config:ov_edit:REPO_ID — extra contains "REPO_ID:field"
    if (setting === 'ov_edit') {
        // Callback data: config:ov_edit:REPO_ID:field
        // After splitting on ':', value='ov_edit', extra='REPO_ID' (but field is lost in standard parsing)
        // We need to handle this via the context approach
        // Since callback_data has a max length, we'll store the edit context in chat state
        const repoId2 = extra;
        if (!repoId2) return renderError('Missing repository.');

        // The field is passed in a different way — we'll use the remaining args
        // Actually, callback_data format: config:ov_edit:REPO_ID:field
        // The router splits as: prefix=config, value=ov_edit, extra=REPO_ID:field
        // So extra contains "REPO_ID:field"
        const colonIdx = repoId2.indexOf(':');
        if (colonIdx === -1) return renderError('Missing field.');
        const actualRepoId = repoId2.substring(0, colonIdx);
        const rawField = repoId2.substring(colonIdx + 1);

        // Map short codes back to full field names
        const shortToField: Record<string, string> = { s: 'summary', ts: 'tech_stack', kf: 'key_features', ta: 'target_audience', bv: 'brand_voice', vt: 'visual_theme' };
        const field = shortToField[rawField] || rawField;

        const fieldLabels: Record<string, string> = {
            summary: 'Summary',
            tech_stack: 'Tech Stack',
            key_features: 'Key Features (comma-separated)',
            target_audience: 'Target Audience',
            brand_voice: 'Brand Voice',
            visual_theme: 'Visual Theme',
        };

        const label = fieldLabels[field] || field;
        const overview = await getRepoOverview(env, actualRepoId, chatId);
        const currentValue = overview ? (overview as unknown as Record<string, unknown>)[field] : null;
        const displayValue = Array.isArray(currentValue) ? (currentValue as string[]).join(', ') : (currentValue as string | null) || '(empty)';

        await updateChatState(env, chatId, {
            current_view: 'overview_edit',
            context: { awaiting_input: 'edit_overview', selected_repo_id: actualRepoId, overview_field: field },
        });

        return {
            text: `✏️ <b>Edit ${label}</b>\n\n<b>Current value:</b>\n${displayValue}\n\nSend the new value:`,
            keyboard: [[{ text: '❌ Cancel', callback_data: `config:edit_overview:${actualRepoId}` }]],
        };
    }

    const repoId = extra;
    const repo = await getRepo(env, repoId!, chatId);
    if (!repo) {
        return renderError('Repository not found.');
    }

    const config = parseRepoConfig(repo);

    switch (setting) {
        case 'hashtags':
            config.includeHashtags = !config.includeHashtags;
            break;
        case 'watchPRs':
            config.watchPRs = !config.watchPRs;
            break;
        case 'watchPushes':
            config.watchPushes = !config.watchPushes;
            break;
        case 'language':
            config.language = config.language === 'en' ? 'he' : 'en';
            break;
        case 'threadImage':
            config.alwaysGenerateThreadImage = !config.alwaysGenerateThreadImage;
            break;
        case 'singleImage': {
            const probs = [0, 0.3, 0.5, 0.7, 1.0];
            const currentProb = config.singleTweetImageProbability;
            const currentIndex = probs.findIndex(p => Math.abs(p - currentProb) < 0.05);
            const nextIndex = (currentIndex + 1) % probs.length;
            config.singleTweetImageProbability = probs[nextIndex];
            break;
        }
        default:
            return renderRepoDetail(env, chatId, repoId!);
    }

    await updateRepo(env, repoId!, chatId, { config });
    return renderRepoDetail(env, chatId, repoId!);
}
