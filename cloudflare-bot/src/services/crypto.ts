/**
 * Encryption Service - AES-256-GCM for user API key storage
 */

import type { Env } from '../types';

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

async function getKey(env: Env): Promise<CryptoKey> {
    if (!env.ENCRYPTION_KEY) {
        throw new Error('ENCRYPTION_KEY not configured');
    }
    const raw = Uint8Array.from(atob(env.ENCRYPTION_KEY), c => c.charCodeAt(0));
    return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/**
 * Encrypt a plaintext string. Returns base64(IV + ciphertext + authTag).
 */
export async function encrypt(env: Env, plaintext: string): Promise<string> {
    const key = await getKey(env);
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const encoded = new TextEncoder().encode(plaintext);
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    // Combine IV + ciphertext (includes auth tag appended by WebCrypto)
    const combined = new Uint8Array(IV_LENGTH + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), IV_LENGTH);
    return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt a base64(IV + ciphertext + authTag) blob. Returns the original plaintext.
 */
export async function decrypt(env: Env, encryptedBlob: string): Promise<string> {
    const key = await getKey(env);
    const combined = Uint8Array.from(atob(encryptedBlob), c => c.charCodeAt(0));
    const iv = combined.slice(0, IV_LENGTH);
    const ciphertext = combined.slice(IV_LENGTH);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return new TextDecoder().decode(decrypted);
}
