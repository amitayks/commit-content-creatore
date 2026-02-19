/**
 * Schedule Time Input Handler
 *
 * Processes HH:MM input when awaiting_input='schedule_time'.
 * Combines with stored date, converts to UTC using user timezone, schedules draft.
 */

import type { HandlerContext } from '../core/router';
import type { ChatContext } from '../types';
import { respond } from '../core/respond';
import { updateChatState, scheduleDraft, getTimezone } from '../services/db';
import { renderDraftDetail } from '../views/drafts';
import { sendMessage } from '../services/telegram';
import { toUTC, formatLocalTime } from '../services/timezone';

export async function scheduleTimeInput(ctx: HandlerContext & { text: string; context: ChatContext }) {
    const { env, chatId, text: input, context } = ctx;

    const draftId = context.selected_draft_id;
    const date = context.schedule_date; // May be undefined if user is on day picker screen

    if (!draftId) {
        await sendMessage(env, chatId,
            '❌ Schedule context lost. Please try again from the draft.',
            [[{ text: '🏠 Home', callback_data: 'view:home' }]]
        );
        return;
    }

    const timeStr = input.trim();

    // Accept full date+time (YYYY-MM-DD HH:MM) or just time (HH:MM) if day was pre-selected
    const fullMatch = timeStr.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})$/);
    const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})$/);

    if (!fullMatch && !timeMatch) {
        const hint = date
            ? `Send time: <code>HH:MM</code>\nOr full date: <code>YYYY-MM-DD HH:MM</code>`
            : `Send a full date and time: <code>YYYY-MM-DD HH:MM</code>`;
        await sendMessage(env, chatId,
            `❌ Invalid format.\n\n${hint}`,
            [[{ text: '❌ Cancel', callback_data: `draft:${draftId}` }]]
        );
        return;
    }

    // If only time provided but no pre-selected date, require full format
    if (timeMatch && !date) {
        await sendMessage(env, chatId,
            `❌ No date selected.\n\nPlease send a full date and time: <code>YYYY-MM-DD HH:MM</code>\n\nExample: <code>2026-03-15 14:30</code>`,
            [[{ text: '❌ Cancel', callback_data: `draft:${draftId}` }]]
        );
        return;
    }

    let effectiveDate: string;
    let hours: number;
    let minutes: number;

    if (fullMatch) {
        effectiveDate = fullMatch[1];
        hours = parseInt(fullMatch[2], 10);
        minutes = parseInt(fullMatch[3], 10);
    } else {
        effectiveDate = date!;
        hours = parseInt(timeMatch![1], 10);
        minutes = parseInt(timeMatch![2], 10);
    }

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        await sendMessage(env, chatId,
            `❌ Invalid time. Hours must be 0-23, minutes 0-59.\n\nExample: <code>14:30</code>`,
            [[{ text: '❌ Cancel', callback_data: `draft:${draftId}` }]]
        );
        return;
    }

    const tz = await getTimezone(env, chatId);

    // Combine date + time
    const localDateStr = `${effectiveDate}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
    const localDate = new Date(localDateStr);

    if (isNaN(localDate.getTime())) {
        await sendMessage(env, chatId,
            '❌ Invalid date/time combination. Please try again.',
            [[{ text: '❌ Cancel', callback_data: `draft:${draftId}` }]]
        );
        return;
    }

    // Convert to UTC
    const scheduledAtUTC = toUTC(localDate, tz);

    // Validate not in the past
    if (scheduledAtUTC.getTime() <= Date.now()) {
        await sendMessage(env, chatId,
            `❌ That time is in the past.\n\nPlease provide a future time.\n\nFormat: <code>HH:MM</code>`,
            [[{ text: '❌ Cancel', callback_data: `draft:${draftId}` }]]
        );
        return;
    }

    try {
        await scheduleDraft(env, draftId, chatId, scheduledAtUTC.toISOString());
        await updateChatState(env, chatId, {
            current_view: 'draft_detail',
            context: { selected_draft_id: draftId },
        });

        const view = await renderDraftDetail(env, chatId, draftId, tz);
        await respond(env, chatId, view, {
            viewName: 'draft_detail',
            context: { selected_draft_id: draftId },
        });
    } catch (error) {
        console.error('[schedule-time] Error:', error);
        await sendMessage(env, chatId,
            `❌ Failed to schedule draft. Please try again.`,
            [[{ text: '❌ Cancel', callback_data: `draft:${draftId}` }]]
        );
    }
}
