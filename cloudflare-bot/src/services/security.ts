/**
 * Security Service - Authorization, validation, and security utilities
 */

import type { Env, TelegramUpdate, User } from '../types';
import { getUser } from './user-db';

// ==================== TELEGRAM AUTHORIZATION ====================

/**
 * Extract user ID from any Telegram update type
 */
export function getUserIdFromUpdate(update: TelegramUpdate): number | null {
    // Message (including /commands)
    if (update.message?.from?.id) {
        return update.message.from.id;
    }

    // Edited message
    if (update.edited_message?.from?.id) {
        return update.edited_message.from.id;
    }

    // Callback query (button clicks)
    if (update.callback_query?.from?.id) {
        return update.callback_query.from.id;
    }

    // Inline query (future-proofing)
    if ('inline_query' in update && (update as any).inline_query?.from?.id) {
        return (update as any).inline_query.from.id;
    }

    return null;
}

/**
 * Check if a user is the admin (no DB access needed)
 */
export function isAdmin(chatId: string | number, env: Env): boolean {
    if (!env.ADMIN_CHAT_ID) return false;
    return String(chatId) === env.ADMIN_CHAT_ID;
}

/**
 * Check if a Telegram user is authorized (active in users table).
 * Returns the user object if authorized, null otherwise.
 */
export async function isAuthorizedUser(userId: number | null, env: Env): Promise<User | null> {
    if (userId === null) return null;
    const user = await getUser(env, String(userId));
    if (!user) return null;
    if (user.status === 'active') return user;
    return null;
}

/**
 * Get user auth state for routing decisions.
 * Returns: 'active' | 'onboarding' | 'suspended' | 'unregistered'
 */
export async function getUserAuthState(
    userId: number | null,
    env: Env
): Promise<{ state: 'active' | 'onboarding' | 'suspended' | 'unregistered'; user: User | null }> {
    if (userId === null) return { state: 'unregistered', user: null };
    const user = await getUser(env, String(userId));
    if (!user) return { state: 'unregistered', user: null };
    return { state: user.status as 'active' | 'onboarding' | 'suspended', user };
}

// ==================== ADMIN AUTHORIZATION ====================

/**
 * Verify admin secret using timing-safe comparison
 */
export async function verifyAdminSecret(request: Request, env: Env): Promise<boolean> {
    const adminSecret = env.ADMIN_SECRET;
    if (!adminSecret) {
        // If no admin secret configured, reject all admin requests
        console.error('ADMIN_SECRET not configured - admin endpoints disabled');
        return false;
    }

    const providedSecret = request.headers.get('X-Admin-Secret');
    if (!providedSecret) {
        return false;
    }

    return timingSafeEqual(providedSecret, adminSecret);
}

// ==================== CRYPTOGRAPHIC SECURITY ====================

/**
 * Timing-safe string comparison to prevent timing attacks
 */
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
    const encoder = new TextEncoder();
    const aBytes = encoder.encode(a);
    const bBytes = encoder.encode(b);

    // If lengths differ, still do comparison to maintain constant time
    // but result will be false
    if (aBytes.length !== bBytes.length) {
        // Compare with self to maintain timing
        const key = await crypto.subtle.importKey(
            'raw',
            aBytes,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        const sig1 = await crypto.subtle.sign('HMAC', key, aBytes);
        const sig2 = await crypto.subtle.sign('HMAC', key, aBytes);
        // Always compare same-length arrays
        const arr1 = new Uint8Array(sig1);
        const arr2 = new Uint8Array(sig2);
        let result = 0;
        for (let i = 0; i < arr1.length; i++) {
            result |= arr1[i] ^ arr2[i];
        }
        return false; // Length mismatch
    }

    // Use HMAC-based comparison for timing safety
    const key = await crypto.subtle.importKey(
        'raw',
        aBytes,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const sig1 = await crypto.subtle.sign('HMAC', key, aBytes);
    const sig2 = await crypto.subtle.sign('HMAC', key, bBytes);

    const arr1 = new Uint8Array(sig1);
    const arr2 = new Uint8Array(sig2);

    let result = 0;
    for (let i = 0; i < arr1.length; i++) {
        result |= arr1[i] ^ arr2[i];
    }

    return result === 0;
}

// ==================== R2 SECURITY ====================

/**
 * Validate R2 key to prevent path traversal attacks
 */
export function validateR2Key(key: string): boolean {
    // Reject empty keys
    if (!key || key.length === 0) {
        return false;
    }

    // Reject path traversal attempts
    if (key.includes('..')) {
        return false;
    }

    // Reject absolute paths
    if (key.startsWith('/')) {
        return false;
    }

    // Reject double slashes
    if (key.includes('//')) {
        return false;
    }

    // Only allow safe characters: alphanumeric, dash, underscore, slash, dot
    const safePattern = /^[a-zA-Z0-9\-_\/\.]+$/;
    if (!safePattern.test(key)) {
        return false;
    }

    // Reject if key is too long
    if (key.length > 500) {
        return false;
    }

    return true;
}

/**
 * Generate a signed URL for R2 image access (simplified version using HMAC)
 */
export async function generateSignedImageUrl(
    baseUrl: string,
    key: string,
    env: Env,
    expiresInSeconds: number = 3600
): Promise<string> {
    const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const message = `${key}:${expires}`;

    // Use TELEGRAM_BOT_TOKEN as signing key (always available)
    const encoder = new TextEncoder();
    const keyData = encoder.encode(env.TELEGRAM_BOT_TOKEN);
    const messageData = encoder.encode(message);

    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const signatureHex = Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    return `${baseUrl}/image/${key}?expires=${expires}&sig=${signatureHex}`;
}

/**
 * Verify a signed image URL
 */
export async function verifySignedImageUrl(
    key: string,
    expires: string,
    signature: string,
    env: Env
): Promise<boolean> {
    // Check expiration
    const expiresNum = parseInt(expires, 10);
    if (isNaN(expiresNum) || expiresNum < Math.floor(Date.now() / 1000)) {
        return false;
    }

    // Verify signature
    const message = `${key}:${expires}`;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(env.TELEGRAM_BOT_TOKEN);
    const messageData = encoder.encode(message);

    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const expectedSig = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const expectedHex = Array.from(new Uint8Array(expectedSig))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    return await timingSafeEqual(signature, expectedHex);
}

// ==================== ERROR HANDLING ====================

/**
 * Sanitize error message to prevent information disclosure
 */
export function sanitizeError(error: unknown): string {
    // Never expose actual error details to users
    const errorStr = String(error);

    // Check for common sensitive patterns and return generic messages
    if (errorStr.includes('D1') || errorStr.includes('SQL') || errorStr.includes('database')) {
        return 'A database error occurred. Please try again later.';
    }

    if (errorStr.includes('API') || errorStr.includes('token') || errorStr.includes('key')) {
        return 'An external service error occurred. Please try again later.';
    }

    if (errorStr.includes('TELEGRAM') || errorStr.includes('bot')) {
        return 'A messaging error occurred. Please try again later.';
    }

    if (errorStr.includes('fetch') || errorStr.includes('network')) {
        return 'A network error occurred. Please try again later.';
    }

    // Generic fallback
    return 'An error occurred. Please try again later.';
}

// ==================== SECURITY HEADERS ====================

/**
 * Add security headers to a response
 */
export function addSecurityHeaders(response: Response): Response {
    const headers = new Headers(response.headers);

    // Prevent MIME type sniffing
    headers.set('X-Content-Type-Options', 'nosniff');

    // Prevent clickjacking
    headers.set('X-Frame-Options', 'DENY');

    // XSS protection (legacy but still useful)
    headers.set('X-XSS-Protection', '1; mode=block');

    // Don't reveal server info
    headers.delete('Server');

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
}

/**
 * Create a secure JSON response with security headers
 */
export function secureJsonResponse(
    data: unknown,
    status: number = 200,
    cacheControl: string = 'no-store'
): Response {
    const headers = new Headers({
        'Content-Type': 'application/json',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Cache-Control': cacheControl,
    });

    return new Response(JSON.stringify(data), { status, headers });
}

/**
 * Create a secure error response (sanitized)
 */
export function secureErrorResponse(error: unknown, status: number = 500): Response {
    return secureJsonResponse({ error: sanitizeError(error) }, status);
}

// ==================== INPUT VALIDATION ====================

/**
 * Validate that a string is a valid chat ID format
 */
export function isValidChatId(chatId: string): boolean {
    // Chat IDs are numeric (can be negative for groups)
    return /^-?\d+$/.test(chatId);
}

/**
 * Validate JSON request body with size limit
 */
export async function parseJsonBody<T>(
    request: Request,
    maxSizeBytes: number = 1024 * 1024 // 1MB default
): Promise<T | null> {
    try {
        // SECURITY: Check Content-Type header
        const contentType = request.headers.get('Content-Type');
        if (contentType && !contentType.includes('application/json')) {
            return null;
        }

        const contentLength = request.headers.get('Content-Length');
        if (contentLength && parseInt(contentLength, 10) > maxSizeBytes) {
            return null;
        }

        const text = await request.text();
        if (text.length > maxSizeBytes) {
            return null;
        }

        return JSON.parse(text) as T;
    } catch {
        return null;
    }
}

// ==================== RATE LIMITING ====================

/**
 * Simple in-memory rate limiter using a sliding window approach
 * Note: For production with multiple workers, use KV or Durable Objects
 */
const rateLimitStore = new Map<string, { count: number; windowStart: number }>();

/**
 * Rate limit configuration
 */
interface RateLimitConfig {
    windowMs: number;      // Time window in milliseconds
    maxRequests: number;   // Max requests per window
}

/**
 * Default rate limit configurations
 */
export const RATE_LIMITS = {
    webhook: { windowMs: 60000, maxRequests: 100 },      // 100 req/min for Telegram webhook
    admin: { windowMs: 60000, maxRequests: 5 },          // 5 req/min for admin endpoints
    image: { windowMs: 60000, maxRequests: 50 },         // 50 req/min for images
    github: { windowMs: 60000, maxRequests: 30 },        // 30 req/min for GitHub webhook
} as const;

/**
 * Check if a request should be rate limited
 * @returns Object with allowed status and remaining requests
 */
export function checkRateLimit(
    key: string,
    config: RateLimitConfig
): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const record = rateLimitStore.get(key);

    // Clean old entries periodically (simple garbage collection)
    if (rateLimitStore.size > 10000) {
        for (const [k, v] of rateLimitStore.entries()) {
            if (now - v.windowStart > config.windowMs) {
                rateLimitStore.delete(k);
            }
        }
    }

    // New or expired window
    if (!record || now - record.windowStart > config.windowMs) {
        rateLimitStore.set(key, { count: 1, windowStart: now });
        return {
            allowed: true,
            remaining: config.maxRequests - 1,
            resetAt: now + config.windowMs,
        };
    }

    // Within window
    if (record.count >= config.maxRequests) {
        return {
            allowed: false,
            remaining: 0,
            resetAt: record.windowStart + config.windowMs,
        };
    }

    // Increment and allow
    record.count++;
    return {
        allowed: true,
        remaining: config.maxRequests - record.count,
        resetAt: record.windowStart + config.windowMs,
    };
}

/**
 * Create a rate-limited response with appropriate headers
 */
export function rateLimitResponse(
    resetAt: number,
    limit: number
): Response {
    const headers = new Headers({
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
        'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
    });

    return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        { status: 429, headers }
    );
}

/**
 * Add rate limit headers to a response
 */
export function addRateLimitHeaders(
    response: Response,
    remaining: number,
    resetAt: number,
    limit: number
): Response {
    const headers = new Headers(response.headers);
    headers.set('X-RateLimit-Limit', String(limit));
    headers.set('X-RateLimit-Remaining', String(remaining));
    headers.set('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
}

// ==================== SECURE LOGGING ====================

/**
 * Patterns that indicate sensitive data that should be redacted
 */
const SENSITIVE_PATTERNS = [
    /token[=:]\s*["']?[\w\-\.]+["']?/gi,
    /api[_-]?key[=:]\s*["']?[\w\-\.]+["']?/gi,
    /secret[=:]\s*["']?[\w\-\.]+["']?/gi,
    /password[=:]\s*["']?[\w\-\.]+["']?/gi,
    /authorization[=:]\s*["']?[\w\-\.\s]+["']?/gi,
    /bearer\s+[\w\-\.]+/gi,
    /bot\d+:[\w\-]+/gi,  // Telegram bot tokens
    /ghp_[\w]+/gi,        // GitHub personal access tokens
    /gho_[\w]+/gi,        // GitHub OAuth tokens
    /github_pat_[\w]+/gi, // GitHub fine-grained tokens
    /xai-[\w]+/gi,        // Grok API keys
];

/**
 * Redact sensitive information from a string
 */
export function redactSensitive(input: string): string {
    let result = input;
    for (const pattern of SENSITIVE_PATTERNS) {
        result = result.replace(pattern, '[REDACTED]');
    }
    return result;
}

/**
 * Safe logging function that redacts sensitive information
 */
export function safeLog(level: 'log' | 'warn' | 'error', message: string, ...args: unknown[]): void {
    const redactedMessage = redactSensitive(message);
    const redactedArgs = args.map(arg => {
        if (typeof arg === 'string') {
            return redactSensitive(arg);
        }
        if (typeof arg === 'object' && arg !== null) {
            try {
                return redactSensitive(JSON.stringify(arg));
            } catch {
                return '[Object]';
            }
        }
        return arg;
    });

    console[level](redactedMessage, ...redactedArgs);
}

/**
 * Log info safely
 */
export function logInfo(message: string, ...args: unknown[]): void {
    safeLog('log', message, ...args);
}

/**
 * Log warning safely
 */
export function logWarn(message: string, ...args: unknown[]): void {
    safeLog('warn', message, ...args);
}

/**
 * Log error safely
 */
export function logError(message: string, ...args: unknown[]): void {
    safeLog('error', message, ...args);
}

// ==================== CONTENT VALIDATION ====================

/**
 * Validate and sanitize content size (for commit messages, PR bodies, etc.)
 */
export function sanitizeContent(content: string, maxLength: number = 10000): string {
    if (!content) return '';
    // Truncate if too long
    if (content.length > maxLength) {
        return content.substring(0, maxLength) + '... [truncated]';
    }
    return content;
}

/**
 * Validate image content type
 */
export function isValidImageContentType(contentType: string | null): boolean {
    if (!contentType) return false;
    const validTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    return validTypes.some(type => contentType.toLowerCase().includes(type));
}

/**
 * Validate file size for R2 uploads
 */
export function isValidFileSize(size: number, maxSizeMB: number = 10): boolean {
    const maxBytes = maxSizeMB * 1024 * 1024;
    return size > 0 && size <= maxBytes;
}
