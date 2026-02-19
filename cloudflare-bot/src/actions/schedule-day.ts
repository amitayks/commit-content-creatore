/**
 * Schedule Day Picker Action — stores selected date and prompts for time
 *
 * Callback format: action:sched_day:DRAFT_ID:YYYY-MM-DD
 * Since callback_data only gives us value=DRAFT_ID, extra=YYYY-MM-DD
 * through the action dispatch, we parse extra to get the date.
 */

import type { HandlerContext } from '../core/router';
import type { ViewResult } from '../types';
import { updateChatState } from '../services/db';

export async function schedDayAction(ctx: HandlerContext & { value: string; extra?: string }): Promise<ViewResult> {
    // Callback: action:sched_day:DRAFT_ID:YYYY-MM-DD
    // Router gives us: value="sched_day", extra="DRAFT_ID:YYYY-MM-DD"
    // Parse extra to split draft ID and date
    const extraParts = (ctx.extra || '').split(':');
    const draftId = extraParts[0];
    const date = extraParts.slice(1).join(':');

    if (!draftId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return {
            text: '❌ Invalid date format.',
            keyboard: [[{ text: '🏠 Home', callback_data: 'view:home' }]],
        };
    }

    await updateChatState(ctx.env, ctx.chatId, {
        context: {
            awaiting_input: 'schedule_time',
            selected_draft_id: draftId,
            schedule_date: date,
        },
    });

    return {
        text: `📅 <b>Schedule for ${date}</b>

Send the time in <b>HH:MM</b> format (e.g. <code>14:30</code>)

Or send a full date and time: <code>YYYY-MM-DD HH:MM</code>`,
        keyboard: [[{ text: '❌ Cancel', callback_data: `draft:${draftId}` }]],
    };
}
