import { logger } from "./logger";

interface RetryOptions {
  /** Maximum number of attempts (including the first). Default: 3. */
  maxAttempts?: number;
  /** Base delay in ms between retries (doubled each attempt). Default: 500. */
  baseDelayMs?: number;
  /** HTTP status codes that should trigger a retry. Default: 429, 500, 502, 503, 504. */
  retryableStatuses?: number[];
  /** Label used in log messages. */
  label?: string;
}

const DEFAULT_RETRYABLE = new Set([429, 500, 502, 503, 504]);

/**
 * Wraps a fetch call with exponential-backoff retry for transient failures.
 * Only retries on network errors and retryable HTTP status codes.
 */
export async function fetchWithRetry(
  input: string | URL | Request,
  init?: RequestInit,
  opts?: RetryOptions,
): Promise<Response> {
  const maxAttempts = opts?.maxAttempts ?? 3;
  const baseDelay = opts?.baseDelayMs ?? 500;
  const retryable = opts?.retryableStatuses
    ? new Set(opts.retryableStatuses)
    : DEFAULT_RETRYABLE;
  const label = opts?.label ?? "fetch";

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(input, init);

      if (res.ok || !retryable.has(res.status) || attempt === maxAttempts) {
        return res;
      }

      logger.warn(`${label} returned ${res.status}, retrying (${attempt}/${maxAttempts})`);
    } catch (err) {
      lastError = err;

      // Don't retry aborted requests
      if (err instanceof DOMException && err.name === "AbortError") throw err;

      if (attempt === maxAttempts) throw err;

      logger.warn(`${label} network error, retrying (${attempt}/${maxAttempts})`);
    }

    await new Promise((r) => setTimeout(r, baseDelay * 2 ** (attempt - 1)));
  }

  throw lastError;
}
