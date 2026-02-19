import type { HandlerContext } from '../core/router';
import type { ChatContext } from '../types';
import { respond } from '../core/respond';
import { updateChatState, createDraft, scheduleDraft, getDraft, getTimezone } from '../services/db';
import { getContentSource } from '../services/github';
import { generateContent } from '../services/gemini';
import { renderError, renderSuccess } from '../views';
import { renderDraftDetail } from '../views/drafts';
import { sendMessage } from '../services/telegram';
import { toUTC, formatLocalTime } from '../services/timezone';

export async function scheduleInput(ctx: HandlerContext & { text: string; context: ChatContext }) {
    const { env, chatId, text: input, context } = ctx;
    const tz = await getTimezone(env, chatId);

    // Flow 1: Schedule an existing draft (came from Schedule button on draft detail)
    if (context.selected_draft_id) {
        const datetime = input.trim();
        const localDate = new Date(datetime);

        if (isNaN(localDate.getTime())) {
            await sendMessage(env, chatId,
                `❌ Invalid datetime format.\n\nPlease use: <code>YYYY-MM-DD HH:MM</code>\n\nExample: <code>2026-02-10 14:00</code>`,
                [[{ text: '❌ Cancel', callback_data: `draft:${context.selected_draft_id}` }]]
            );
            return;
        }

        // Convert user's local time to UTC for storage
        const scheduledAtUTC = toUTC(localDate, tz);

        // Past-time validation in user's local time
        const nowLocal = new Date(Date.now() + (localDate.getTime() - scheduledAtUTC.getTime()));
        if (localDate.getTime() <= nowLocal.getTime()) {
            await sendMessage(env, chatId,
                `❌ That time is in the past.\n\nPlease provide a future datetime.\n\nFormat: <code>YYYY-MM-DD HH:MM</code>`,
                [[{ text: '❌ Cancel', callback_data: `draft:${context.selected_draft_id}` }]]
            );
            return;
        }

        try {
            await scheduleDraft(env, context.selected_draft_id, chatId, scheduledAtUTC.toISOString());
            await updateChatState(env, chatId, {
                current_view: 'draft_detail',
                context: { selected_draft_id: context.selected_draft_id },
            });

            const view = await renderDraftDetail(env, chatId, context.selected_draft_id, tz);
            await respond(env, chatId, view, {
                viewName: 'draft_detail',
                context: { selected_draft_id: context.selected_draft_id },
            });
        } catch (error) {
            await sendMessage(env, chatId,
                `❌ Failed to schedule draft. Please try again.\n\nFormat: <code>YYYY-MM-DD HH:MM</code>`,
                [[{ text: '❌ Cancel', callback_data: `draft:${context.selected_draft_id}` }]]
            );
        }
        return;
    }

    // Flow 2: /schedule command — create new draft + schedule (SHA DATETIME)
    const parts = input.split(' ');
    const sha = parts[0];
    const datetime = parts.slice(1).join(' ');

    if (!sha || !datetime) {
        await sendMessage(env, chatId,
            `❌ Please provide both commit SHA and datetime.\n\nFormat: <code>SHA YYYY-MM-DD HH:MM</code>\nExample: <code>abc1234 2024-01-15 14:00</code>`,
            [[{ text: '❌ Cancel', callback_data: 'view:home' }]]
        );
        return;
    }

    try {
        const localDate = new Date(datetime);
        if (isNaN(localDate.getTime())) {
            await sendMessage(env, chatId,
                `❌ Invalid datetime format.\n\nFormat: <code>SHA YYYY-MM-DD HH:MM</code>\nExample: <code>abc1234 2024-01-15 14:00</code>`,
                [[{ text: '❌ Cancel', callback_data: 'view:home' }]]
            );
            return;
        }

        // Convert user's local time to UTC
        const scheduledAtUTC = toUTC(localDate, tz);

        const source = await getContentSource(env, sha);
        const prNumber = source.type === 'pr' ? source.data.number : 0;
        const prTitle = source.type === 'pr' ? source.data.title : source.data.title;

        const result = await generateContent(env, source);
        const content = result.content;

        await createDraft(env, chatId, {
            pr_number: prNumber,
            pr_title: prTitle,
            commit_sha: sha,
            content: JSON.stringify(content),
        });

        await updateChatState(env, chatId, { context: null });
        const sourceLabel = source.type === 'pr' ? `PR #${prNumber}` : `commit ${sha.substring(0, 7)}`;
        const timeDisplay = formatLocalTime(scheduledAtUTC.toISOString(), tz);
        await respond(env, chatId, renderSuccess(
            `📅 Scheduled post for ${sourceLabel}\n\nWill publish on ${timeDisplay}`
        ));
    } catch (error) {
        await sendMessage(env, chatId,
            `❌ <b>Schedule failed</b>\n\nCouldn't process <code>${sha.substring(0, 7)}</code>. Send another SHA + datetime to try again.\n\nFormat: <code>SHA YYYY-MM-DD HH:MM</code>`,
            [[{ text: '❌ Cancel', callback_data: 'view:home' }]]
        );
    }
}
