import type { HandlerContext } from '../core/router';
import type { ViewResult, InlineButton } from '../types';
import { updateChatState, getTimezone } from '../services/db';
import { applyOffset } from '../services/timezone';

export async function scheduleAction(ctx: HandlerContext & { value: string; extra?: string }): Promise<ViewResult> {
    const draftId = ctx.extra!;
    const tz = await getTimezone(ctx.env, ctx.chatId);

    // Set awaiting_input so user can also type a full date+time directly
    await updateChatState(ctx.env, ctx.chatId, {
        context: {
            awaiting_input: 'schedule_time',
            selected_draft_id: draftId,
        },
    });

    return renderScheduleDayPicker(draftId, tz);
}

/**
 * Render a day picker with 7 day buttons starting from today in user's timezone
 */
export function renderScheduleDayPicker(draftId: string, tz: string): ViewResult {
    const now = new Date();
    const localNow = applyOffset(now, tz);

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const dayButtons: InlineButton[][] = [];
    let row: InlineButton[] = [];

    for (let i = 0; i < 7; i++) {
        const date = new Date(localNow.getTime() + i * 24 * 60 * 60 * 1000);
        const yyyy = date.getUTCFullYear();
        const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(date.getUTCDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;

        const dayName = dayNames[date.getUTCDay()];
        const monthName = monthNames[date.getUTCMonth()];
        const label = i === 0 ? `Today ${dd}` : i === 1 ? `Tomorrow ${dd}` : `${dayName} ${dd}`;

        row.push({
            text: label,
            callback_data: `action:sched_day:${draftId}:${dateStr}`,
        });

        // 3 buttons per row (3, 3, 1)
        if (row.length === 3 || i === 6) {
            dayButtons.push([...row]);
            row = [];
        }
    }

    return {
        text: `📅 <b>Schedule Draft</b>

Select a day (${tz}):

Or send a full date and time: <code>YYYY-MM-DD HH:MM</code>`,
        keyboard: [
            ...dayButtons,
            [{ text: '❌ Cancel', callback_data: `draft:${draftId}` }],
        ],
    };
}
