/**
 * Onboarding Command Handler - Step-by-step key setup flow
 */

import type { Env, TelegramUpdate, TelegramCallbackQuery } from '../types';
import { sendMessage, deleteMessage, editMessage } from '../services/telegram';
import { encrypt } from '../services/crypto';
import { getUser, updateUser, storeEncryptedKey } from '../services/user-db';
import {
    renderWelcome,
    renderLearnMore,
    renderGeminiKeyPrompt,
    renderGeminiSuccess,
    renderXKeysPrompt,
    renderXSuccess,
    renderGitHubTokenPrompt,
    renderGitHubSuccess,
    renderComplete,
    renderKeyError,
} from '../views/onboarding';
import { logInfo, logError, sanitizeError } from '../services/security';

/**
 * Handle a message from a user in the onboarding flow.
 */
export async function handleOnboardingMessage(
    env: Env,
    chatId: string,
    telegramChatId: number,
    update: TelegramUpdate
): Promise<void> {
    const user = await getUser(env, chatId);
    if (!user) return;

    const step = user.onboarding_step;
    const message = update.message;

    // If user hasn't started yet, show welcome
    if (!step || step === 'welcome') {
        const view = renderWelcome();
        await sendMessage(env, telegramChatId, view.text, view.keyboard);
        await updateUser(env, chatId, { onboarding_step: 'welcome' });
        return;
    }

    // Handle text input for key steps
    const text = message?.text?.trim();
    if (!text || !message) return;

    // Handle /start command at any point during onboarding
    if (text === '/start') {
        const view = renderWelcome();
        await sendMessage(env, telegramChatId, view.text, view.keyboard);
        return;
    }

    if (step === 'gemini_key') {
        await handleGeminiKeyInput(env, chatId, telegramChatId, message.message_id, text);
    } else if (step === 'x_keys') {
        await handleXKeysInput(env, chatId, telegramChatId, message.message_id, text);
    } else if (step === 'github_token') {
        await handleGitHubTokenInput(env, chatId, telegramChatId, message.message_id, text);
    }
}

/**
 * Handle callback query from onboarding buttons.
 */
export async function handleOnboardingCallback(
    env: Env,
    chatId: string,
    callbackQuery: TelegramCallbackQuery
): Promise<void> {
    const data = callbackQuery.data;
    if (!data) return;

    const telegramChatId = callbackQuery.message?.chat?.id;
    if (!telegramChatId) return;
    const messageId = callbackQuery.message?.message_id;

    if (data === 'onboard:start') {
        await updateUser(env, chatId, { onboarding_step: 'gemini_key' });
        const view = renderGeminiKeyPrompt();
        if (messageId) {
            await editMessage(env, telegramChatId, messageId, view.text, view.keyboard);
        } else {
            await sendMessage(env, telegramChatId, view.text, view.keyboard);
        }
    } else if (data === 'onboard:learn') {
        const view = renderLearnMore();
        if (messageId) {
            await editMessage(env, telegramChatId, messageId, view.text, view.keyboard);
        } else {
            await sendMessage(env, telegramChatId, view.text, view.keyboard);
        }
    } else if (data === 'onboard:skip_gemini') {
        await updateUser(env, chatId, { onboarding_step: 'x_keys' });
        const view = renderXKeysPrompt();
        if (messageId) {
            await editMessage(env, telegramChatId, messageId, view.text, view.keyboard);
        } else {
            await sendMessage(env, telegramChatId, view.text, view.keyboard);
        }
    } else if (data === 'onboard:skip_github') {
        await completeOnboarding(env, chatId, telegramChatId, messageId);
    } else if (data === 'view:home' || data === 'view:settings') {
        // These are handled by the main router after onboarding completes
    }
}

async function handleGeminiKeyInput(
    env: Env,
    chatId: string,
    telegramChatId: number,
    messageId: number,
    key: string
): Promise<void> {
    // Delete the key message immediately
    try { await deleteMessage(env, telegramChatId, messageId); } catch { }

    // Validate with a test API call
    try {
        const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;
        const response = await fetch(testUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: 'Say "hello" in one word.' }] }],
            }),
        });

        if (!response.ok) {
            const view = renderKeyError('Gemini', `API returned status ${response.status}. Please check your key.`);
            await sendMessage(env, telegramChatId, view.text, view.keyboard);
            return;
        }
    } catch (error) {
        const view = renderKeyError('Gemini', 'Could not validate key. Please try again.');
        await sendMessage(env, telegramChatId, view.text, view.keyboard);
        return;
    }

    // Encrypt and store
    const encrypted = await encrypt(env, key);
    await storeEncryptedKey(env, chatId, 'gemini_key_enc', encrypted);
    await updateUser(env, chatId, { has_gemini: 1, onboarding_step: 'x_keys' });

    // Show success then next step
    const success = renderGeminiSuccess();
    await sendMessage(env, telegramChatId, success.text, success.keyboard);

    const next = renderXKeysPrompt();
    await sendMessage(env, telegramChatId, next.text, next.keyboard);
}

async function handleXKeysInput(
    env: Env,
    chatId: string,
    telegramChatId: number,
    messageId: number,
    text: string
): Promise<void> {
    // Delete the key message immediately
    try { await deleteMessage(env, telegramChatId, messageId); } catch { }

    // Parse 4 lines
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length !== 4) {
        const view = renderKeyError('X', `Expected 4 lines (API_KEY, API_SECRET, ACCESS_TOKEN, ACCESS_SECRET), got ${lines.length}.`);
        await sendMessage(env, telegramChatId, view.text, view.keyboard);
        return;
    }

    const [apiKey, apiSecret, accessToken, accessSecret] = lines;

    // Validate with verifyCredentials
    try {
        const valid = await verifyXCredentials(apiKey, apiSecret, accessToken, accessSecret);
        if (!valid.ok) {
            const view = renderKeyError('X', valid.error || 'Credentials verification failed.');
            await sendMessage(env, telegramChatId, view.text, view.keyboard);
            return;
        }

        // Encrypt and store all 4 keys
        await storeEncryptedKey(env, chatId, 'x_api_key_enc', await encrypt(env, apiKey));
        await storeEncryptedKey(env, chatId, 'x_api_secret_enc', await encrypt(env, apiSecret));
        await storeEncryptedKey(env, chatId, 'x_access_token_enc', await encrypt(env, accessToken));
        await storeEncryptedKey(env, chatId, 'x_access_secret_enc', await encrypt(env, accessSecret));
        await updateUser(env, chatId, { has_x: 1, onboarding_step: 'github_token' });

        const success = renderXSuccess(valid.username);
        await sendMessage(env, telegramChatId, success.text, success.keyboard);

        const next = renderGitHubTokenPrompt();
        await sendMessage(env, telegramChatId, next.text, next.keyboard);
    } catch (error) {
        const view = renderKeyError('X', 'Could not validate credentials. Please try again.');
        await sendMessage(env, telegramChatId, view.text, view.keyboard);
    }
}

async function handleGitHubTokenInput(
    env: Env,
    chatId: string,
    telegramChatId: number,
    messageId: number,
    token: string
): Promise<void> {
    // Delete the key message immediately
    try { await deleteMessage(env, telegramChatId, messageId); } catch { }

    // Validate with GET /user
    try {
        const response = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'User-Agent': 'MuseBot',
                'Accept': 'application/vnd.github.v3+json',
            },
        });

        if (!response.ok) {
            const view = renderKeyError('GitHub', `API returned status ${response.status}. Please check your token.`);
            await sendMessage(env, telegramChatId, view.text, view.keyboard);
            return;
        }

        const userData = await response.json() as { login?: string };

        // Encrypt and store
        const encrypted = await encrypt(env, token);
        await storeEncryptedKey(env, chatId, 'github_token_enc', encrypted);
        await updateUser(env, chatId, { has_github: 1 });

        const success = renderGitHubSuccess(userData.login);
        await sendMessage(env, telegramChatId, success.text, success.keyboard);
    } catch (error) {
        const view = renderKeyError('GitHub', 'Could not validate token. Please try again.');
        await sendMessage(env, telegramChatId, view.text, view.keyboard);
        return;
    }

    // Complete onboarding
    await completeOnboarding(env, chatId, telegramChatId);
}

async function completeOnboarding(
    env: Env,
    chatId: string,
    telegramChatId: number,
    editMessageId?: number
): Promise<void> {
    await updateUser(env, chatId, { status: 'active', onboarding_step: null as any });

    const user = await getUser(env, chatId);
    const view = renderComplete({
        hasGemini: user?.has_gemini === 1,
        hasX: user?.has_x === 1,
        hasGitHub: user?.has_github === 1,
        hasHeyGen: user?.has_heygen === 1,
    });

    if (editMessageId) {
        await editMessage(env, telegramChatId, editMessageId, view.text, view.keyboard);
    } else {
        await sendMessage(env, telegramChatId, view.text, view.keyboard);
    }

    logInfo(`User ${chatId} completed onboarding`);
}

/**
 * Verify X credentials using OAuth 1.0a signature for account/verify_credentials
 */
export async function verifyXCredentials(
    apiKey: string,
    apiSecret: string,
    accessToken: string,
    accessSecret: string
): Promise<{ ok: boolean; username?: string; error?: string }> {
    try {
        const url = 'https://api.x.com/1.1/account/verify_credentials.json';
        const method = 'GET';
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = crypto.randomUUID().replace(/-/g, '');

        const params: Record<string, string> = {
            oauth_consumer_key: apiKey,
            oauth_nonce: nonce,
            oauth_signature_method: 'HMAC-SHA1',
            oauth_timestamp: timestamp,
            oauth_token: accessToken,
            oauth_version: '1.0',
        };

        // Create signature base string
        const paramString = Object.keys(params)
            .sort()
            .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
            .join('&');

        const baseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`;
        const signingKey = `${encodeURIComponent(apiSecret)}&${encodeURIComponent(accessSecret)}`;

        // HMAC-SHA1 signature
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(signingKey),
            { name: 'HMAC', hash: 'SHA-1' },
            false,
            ['sign']
        );
        const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(baseString));
        const signature = btoa(String.fromCharCode(...new Uint8Array(sig)));

        params.oauth_signature = signature;

        const authHeader = 'OAuth ' + Object.keys(params)
            .sort()
            .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(params[k])}"`)
            .join(', ');

        const response = await fetch(url, {
            method,
            headers: { 'Authorization': authHeader },
        });

        if (!response.ok) {
            return { ok: false, error: `X API returned status ${response.status}` };
        }

        const data = await response.json() as { screen_name?: string };
        return { ok: true, username: data.screen_name };
    } catch (error) {
        return { ok: false, error: 'Failed to verify X credentials' };
    }
}
