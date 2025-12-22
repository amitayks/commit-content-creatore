/**
 * Retry utility with exponential backoff.
 */

import logger from './logger.js';

/** Options for retry behavior */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Initial delay in milliseconds */
  initialDelay?: number;
  /** Maximum delay in milliseconds */
  maxDelay?: number;
  /** Backoff multiplier */
  backoffMultiplier?: number;
  /** Custom retry condition */
  shouldRetry?: (error: unknown) => boolean;
  /** Optional context for logging */
  context?: string;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'shouldRetry' | 'context'>> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
};

/**
 * Execute a function with retry logic and exponential backoff.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const context = opts.context || 'operation';

  let lastError: unknown;
  let delay = opts.initialDelay;

  for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (opts.shouldRetry && !opts.shouldRetry(error)) {
        logger.warn(`${context}: Non-retryable error, giving up`, {
          attempt,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }

      // Last attempt, don't retry
      if (attempt > opts.maxRetries) {
        logger.error(`${context}: All ${opts.maxRetries} retries exhausted`, {
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }

      // Log and wait before retry
      logger.warn(`${context}: Attempt ${attempt} failed, retrying in ${delay}ms`, {
        error: error instanceof Error ? error.message : String(error),
        nextAttempt: attempt + 1,
      });

      await sleep(delay);

      // Calculate next delay with exponential backoff
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelay);
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError;
}

/**
 * Sleep for a specified duration.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if an error is a rate limit error (HTTP 429).
 */
export function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('rate limit') ||
      message.includes('429') ||
      message.includes('too many requests')
    );
  }
  return false;
}

/**
 * Check if an error is a transient server error (5xx).
 */
export function isTransientError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504') ||
      message.includes('timeout') ||
      message.includes('econnreset') ||
      message.includes('enotfound')
    );
  }
  return false;
}

/**
 * Default retry condition for API calls.
 */
export function defaultApiRetryCondition(error: unknown): boolean {
  return isRateLimitError(error) || isTransientError(error);
}
