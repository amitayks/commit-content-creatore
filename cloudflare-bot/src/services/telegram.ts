/**
 * Telegram Service - Bot API interactions
 */

import type { Env, InlineButton } from '../types';

const TELEGRAM_API = 'https://api.telegram.org/bot';

/**
 * Send a new message to Telegram
 */
export async function sendMessage(
    env: Env,
    chatId: string | number,
    text: string,
    keyboard?: InlineButton[][]
): Promise<number> {
    const response = await fetch(`${TELEGRAM_API}${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'HTML',
            reply_markup: keyboard ? { inline_keyboard: keyboard } : undefined,
        }),
    });

    const data = await response.json() as { ok: boolean; result?: { message_id: number }; description?: string };

    if (!data.ok || !data.result) {
        console.error('sendMessage failed:', data.description);
        throw new Error(`Failed to send message: ${data.description}`);
    }

    console.log('Sent message:', data.result.message_id);
    return data.result.message_id;
}

/**
 * Edit an existing message
 */
export async function editMessage(
    env: Env,
    chatId: string | number,
    messageId: number,
    text: string,
    keyboard?: InlineButton[][]
): Promise<void> {
    const response = await fetch(`${TELEGRAM_API}${env.TELEGRAM_BOT_TOKEN}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text,
            parse_mode: 'HTML',
            reply_markup: keyboard ? { inline_keyboard: keyboard } : undefined,
        }),
    });

    const data = await response.json() as { ok: boolean; description?: string };

    // "message is not modified" is acceptable - content already matches
    if (!data.ok && !data.description?.includes('message is not modified')) {
        console.error('editMessage failed:', data.description);
        throw new Error(`Failed to edit message: ${data.description}`);
    }
}

/**
 * Answer a callback query (removes loading indicator)
 */
export async function answerCallback(
    env: Env,
    callbackId: string,
    text?: string
): Promise<void> {
    await fetch(`${TELEGRAM_API}${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            callback_query_id: callbackId,
            text,
        }),
    });
}

/**
 * Delete a message
 */
export async function deleteMessage(
    env: Env,
    chatId: string | number,
    messageId: number
): Promise<void> {
    await fetch(`${TELEGRAM_API}${env.TELEGRAM_BOT_TOKEN}/deleteMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
        }),
    });
}

/**
 * Send a photo with optional caption
 */
export async function sendPhoto(
    env: Env,
    chatId: string | number,
    photoUrl: string,
    caption?: string,
    keyboard?: InlineButton[][]
): Promise<number> {
    const response = await fetch(`${TELEGRAM_API}${env.TELEGRAM_BOT_TOKEN}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            photo: photoUrl,
            caption,
            parse_mode: 'HTML',
            reply_markup: keyboard ? { inline_keyboard: keyboard } : undefined,
        }),
    });

    const data = await response.json() as { ok: boolean; result?: { message_id: number }; description?: string };

    if (!data.ok || !data.result) {
        console.error('sendPhoto failed:', data.description);
        throw new Error(`Failed to send photo: ${data.description}`);
    }

    console.log('Sent photo:', data.result.message_id);
    return data.result.message_id;
}

/**
 * Send a message with optional image
 * If imageUrl is provided, sends photo with caption; otherwise sends text message
 */
export async function sendMessageWithImage(
    env: Env,
    chatId: string | number,
    text: string,
    imageUrl?: string | null,
    keyboard?: InlineButton[][]
): Promise<number> {
    if (imageUrl) {
        // Truncate text to 1024 chars for photo captions (Telegram limit)
        const caption = text.length > 1024 ? text.substring(0, 1021) + '...' : text;
        return sendPhoto(env, chatId, imageUrl, caption, keyboard);
    }
    return sendMessage(env, chatId, text, keyboard);
}
