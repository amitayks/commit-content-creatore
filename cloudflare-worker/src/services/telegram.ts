/**
 * Telegram API utilities for the Cloudflare Worker.
 */

import type { Env } from '../index';

export interface TelegramMessage {
    message_id: number;
    chat: { id: number };
    text?: string;
    from?: { id: number; first_name: string };
}

export interface TelegramUpdate {
    update_id: number;
    message?: TelegramMessage;
    callback_query?: {
        id: string;
        from: { id: number; first_name: string };
        message?: TelegramMessage;
        data?: string;
    };
}

export interface InlineButton {
    text: string;
    callback_data: string;
}

/**
 * Send a message to Telegram.
 */
export async function sendMessage(
    env: Env,
    chatId: string | number,
    text: string,
    keyboard?: InlineButton[][]
): Promise<number> {
    const response = await fetch(
        `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: 'HTML',
                reply_markup: keyboard ? { inline_keyboard: keyboard } : undefined,
            }),
        }
    );

    const data = await response.json() as { ok: boolean; result?: { message_id: number } };
    if (!data.ok || !data.result) {
        throw new Error('Failed to send message');
    }
    return data.result.message_id;
}

/**
 * Edit an existing message.
 */
export async function editMessage(
    env: Env,
    chatId: string | number,
    messageId: number,
    text: string,
    keyboard?: InlineButton[][]
): Promise<void> {
    await fetch(
        `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/editMessageText`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                message_id: messageId,
                text,
                parse_mode: 'HTML',
                reply_markup: keyboard ? { inline_keyboard: keyboard } : undefined,
            }),
        }
    );
}

/**
 * Answer a callback query.
 */
export async function answerCallback(
    env: Env,
    callbackId: string,
    text?: string
): Promise<void> {
    await fetch(
        `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                callback_query_id: callbackId,
                text,
            }),
        }
    );
}
