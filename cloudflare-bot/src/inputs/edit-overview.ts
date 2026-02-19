import type { HandlerContext } from '../core/router';
import type { ChatContext } from '../types';
import { updateChatState, updateOverviewField } from '../services/db';
import { sendMessage } from '../services/telegram';

export async function editOverviewInput(ctx: HandlerContext & { text: string; context: ChatContext }) {
    const { env, chatId, text, context } = ctx;

    const repoId = context.selected_repo_id;
    const field = context.overview_field;

    if (!repoId || !field) {
        await sendMessage(env, chatId, '❌ Missing context. Please try again.',
            [[{ text: '🏠 Home', callback_data: 'view:home' }]]
        );
        return;
    }

    // For key_features, the user sends comma-separated values — store as JSON array
    const value = field === 'key_features'
        ? JSON.stringify(text.split(',').map(s => s.trim()).filter(Boolean))
        : text.trim();

    const success = await updateOverviewField(env, repoId, field, value);

    // Clear input state
    await updateChatState(env, chatId, { context: null });

    if (success) {
        await sendMessage(env, chatId, `✅ Updated <b>${field.replace('_', ' ')}</b> successfully.`,
            [[{ text: '◀️ Back to repo', callback_data: `repo:${repoId}` }]]
        );
    } else {
        await sendMessage(env, chatId, '❌ Failed to update. Make sure an overview exists first.',
            [[{ text: '◀️ Back to repo', callback_data: `repo:${repoId}` }]]
        );
    }
}
