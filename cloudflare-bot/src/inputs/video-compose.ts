/**
 * Video compose input handler — buffers user messages as manual instructions
 */

import type { HandlerContext } from '../core/router';
import type { ChatContext } from '../types';
import { updateChatState } from '../services/db';
import { sendMessage } from '../services/telegram';

interface VideoComposeInputContext extends HandlerContext {
    text: string;
    context: ChatContext;
    message?: {
        message_id: number;
        photo?: Array<{ file_id: string; file_size?: number }>;
        caption?: string;
    };
}

export async function videoComposeInput(ctx: VideoComposeInputContext): Promise<void> {
    const { env, chatId, text, context } = ctx;
    const vc = context.videoCompose;

    if (!vc || !vc.active) return;

    // Collect instruction text
    let instruction = '';
    if (ctx.message?.photo && ctx.message.photo.length > 0) {
        instruction = ctx.message.caption || '(attached reference image)';
    } else if (text) {
        instruction = text;
    }

    if (!instruction) return;

    vc.instructions.push(instruction);

    await updateChatState(env, chatId, {
        context: { ...context, videoCompose: vc },
    });

    const count = vc.instructions.length;
    await sendMessage(env, chatId,
        `📝 Instruction ${count} added. Send more or tap <b>Save</b> when done.`,
    );
}
