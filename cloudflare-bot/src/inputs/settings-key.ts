/**
 * Settings Key Input — validate, encrypt, and store API keys from settings flow
 */

import type { HandlerContext } from '../core/router';
import type { ViewResult, ChatContext } from '../types';
import { deleteMessage } from '../services/telegram';
import { encrypt } from '../services/crypto';
import { storeEncryptedKey, updateUser, getUser } from '../services/user-db';
import { renderApiKeys } from '../views/settings';

export async function settingsKeyInput(
    ctx: HandlerContext & { text: string; context: ChatContext }
): Promise<ViewResult | void> {
    const { env, chatId, messageId, text, context } = ctx;
    const service = context?.key_service as string;
    if (!service) return;

    // Delete the key message immediately
    if (messageId) {
        try { await deleteMessage(env, Number(chatId), messageId); } catch { }
    }

    if (service === 'gemini') {
        try {
            const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${text}`;
            const response = await fetch(testUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: 'Say "hello" in one word.' }] }] }),
            });
            if (!response.ok) {
                return {
                    text: `❌ Gemini key validation failed (status ${response.status}). Please check and try again.`,
                    keyboard: [[{ text: '◀️ Back', callback_data: 'settings:keys' }]],
                };
            }
        } catch {
            return {
                text: '❌ Could not validate Gemini key. Please try again.',
                keyboard: [[{ text: '◀️ Back', callback_data: 'settings:keys' }]],
            };
        }
        await storeEncryptedKey(env, chatId, 'gemini_key_enc', await encrypt(env, text));
        await updateUser(env, chatId, { has_gemini: 1 });
    } else if (service === 'x') {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length !== 4) {
            return {
                text: `❌ Expected 4 lines (API_KEY, API_SECRET, ACCESS_TOKEN, ACCESS_SECRET), got ${lines.length}.`,
                keyboard: [[{ text: '◀️ Back', callback_data: 'settings:keys' }]],
            };
        }
        const [apiKey, apiSecret, accessToken, accessSecret] = lines;

        // Validate with OAuth 1.0a verifyCredentials
        const { verifyXCredentials } = await import('../commands/onboarding');
        const result = await verifyXCredentials(apiKey, apiSecret, accessToken, accessSecret);
        if (!result.ok) {
            return {
                text: `❌ X credential validation failed: ${result.error || 'Unknown error'}`,
                keyboard: [[{ text: '◀️ Back', callback_data: 'settings:keys' }]],
            };
        }

        await storeEncryptedKey(env, chatId, 'x_api_key_enc', await encrypt(env, apiKey));
        await storeEncryptedKey(env, chatId, 'x_api_secret_enc', await encrypt(env, apiSecret));
        await storeEncryptedKey(env, chatId, 'x_access_token_enc', await encrypt(env, accessToken));
        await storeEncryptedKey(env, chatId, 'x_access_secret_enc', await encrypt(env, accessSecret));
        await updateUser(env, chatId, { has_x: 1 });
    } else if (service === 'github') {
        try {
            const response = await fetch('https://api.github.com/user', {
                headers: {
                    'Authorization': `Bearer ${text}`,
                    'User-Agent': 'MuseBot',
                    'Accept': 'application/vnd.github.v3+json',
                },
            });
            if (!response.ok) {
                return {
                    text: `❌ GitHub token validation failed (status ${response.status}). Please check and try again.`,
                    keyboard: [[{ text: '◀️ Back', callback_data: 'settings:keys' }]],
                };
            }
        } catch {
            return {
                text: '❌ Could not validate GitHub token. Please try again.',
                keyboard: [[{ text: '◀️ Back', callback_data: 'settings:keys' }]],
            };
        }
        await storeEncryptedKey(env, chatId, 'github_token_enc', await encrypt(env, text));
        await updateUser(env, chatId, { has_github: 1 });
    } else if (service === 'instagram') {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length !== 2) {
            return {
                text: `❌ Expected 2 lines (ACCESS_TOKEN, BUSINESS_ACCOUNT_ID), got ${lines.length}.`,
                keyboard: [[{ text: '◀️ Back', callback_data: 'settings:keys' }]],
            };
        }
        const [accessToken, businessAccountId] = lines;

        // Validate by calling Facebook Graph API
        try {
            const response = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${accessToken}`);
            if (!response.ok) {
                return {
                    text: `❌ Instagram token validation failed (status ${response.status}). Please check and try again.`,
                    keyboard: [[{ text: '◀️ Back', callback_data: 'settings:keys' }]],
                };
            }
        } catch {
            return {
                text: '❌ Could not validate Instagram token. Please try again.',
                keyboard: [[{ text: '◀️ Back', callback_data: 'settings:keys' }]],
            };
        }

        await storeEncryptedKey(env, chatId, 'instagram_token_enc', await encrypt(env, accessToken));
        await storeEncryptedKey(env, chatId, 'instagram_account_id_enc', await encrypt(env, businessAccountId));
        await updateUser(env, chatId, { has_instagram: 1 });
    }

    // Show success and updated API keys view
    const user = await getUser(env, chatId);
    return renderApiKeys({
        hasGemini: user?.has_gemini === 1,
        hasX: user?.has_x === 1,
        hasGitHub: user?.has_github === 1,
        hasInstagram: user?.has_instagram === 1,
    });
}
