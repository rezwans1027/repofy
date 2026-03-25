import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../../src/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { fetchWithRetry } from "../../../src/lib/retry";
import { logger } from "../../../src/lib/logger";

const mockFetch = vi.fn();

function mockResponse(
  status: number,
  opts?: { headers?: Record<string, string> },
): Response {
  const ok = status >= 200 && status < 300;
  const headers = new Headers(opts?.headers);
  return {
    ok,
    status,
    headers,
    text: vi.fn().mockResolvedValue(""),
    json: vi.fn().mockResolvedValue({}),
    statusText: ok ? "OK" : "Error",
  } as unknown as Response;
}

describe("fetchWithRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // ── Success on first attempt ────────────────────────────────────────

  it("returns response on first attempt when ok", async () => {
    const res = mockResponse(200);
    mockFetch.mockResolvedValue(res);

    const result = await fetchWithRetry("http://example.com/api", { method: "GET" });

    expect(result).toBe(res);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  // ── Non-retryable error ─────────────────────────────────────────────

  it("returns non-retryable error response immediately (e.g., 404)", async () => {
    const res = mockResponse(404);
    mockFetch.mockResolvedValue(res);

    const result = await fetchWithRetry("http://example.com/api");

    expect(result).toBe(res);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("returns 401 immediately without retry", async () => {
    const res = mockResponse(401);
    mockFetch.mockResolvedValue(res);

    const result = await fetchWithRetry("http://example.com/api");

    expect(result).toBe(res);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  // ── Retries on retryable status codes ───────────────────────────────

  describe("retries on retryable status codes", () => {
    for (const status of [429, 500, 502, 503, 504]) {
      it(`retries on ${status} and returns success on next attempt`, async () => {
        const errorRes = mockResponse(status);
        const okRes = mockResponse(200);
        mockFetch.mockResolvedValueOnce(errorRes).mockResolvedValueOnce(okRes);

        const promise = fetchWithRetry("http://example.com/api", undefined, {
          label: "test",
        });

        // Advance past the first retry delay (500ms)
        await vi.advanceTimersByTimeAsync(500);

        const result = await promise;
        expect(result).toBe(okRes);
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining(`returned ${status}`),
        );
      });
    }
  });

  // ── Retry-After header ──────────────────────────────────────────────

  it("respects Retry-After header (value in seconds)", async () => {
    const errorRes = mockResponse(429, { headers: { "Retry-After": "2" } });
    const okRes = mockResponse(200);
    mockFetch.mockResolvedValueOnce(errorRes).mockResolvedValueOnce(okRes);

    const promise = fetchWithRetry("http://example.com/api");

    // Retry-After: 2 means 2000ms delay
    await vi.advanceTimersByTimeAsync(2000);

    const result = await promise;
    expect(result).toBe(okRes);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  // ── maxAttempts exhaustion ──────────────────────────────────────────

  it("stops after maxAttempts and returns the last response", async () => {
    const res500 = mockResponse(500);
    mockFetch.mockResolvedValue(res500);

    const promise = fetchWithRetry("http://example.com/api", undefined, {
      maxAttempts: 3,
    });

    // Advance through all retry delays: 500ms + 1000ms
    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(1000);

    const result = await promise;
    expect(result.status).toBe(500);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  // ── Network errors ──────────────────────────────────────────────────

  it("retries on network errors (fetch throws)", async () => {
    const networkError = new TypeError("fetch failed");
    const okRes = mockResponse(200);
    mockFetch
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce(okRes);

    const promise = fetchWithRetry("http://example.com/api", undefined, {
      label: "net-test",
    });

    await vi.advanceTimersByTimeAsync(500);

    const result = await promise;
    expect(result).toBe(okRes);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("network error"),
    );
  });

  it("throws after maxAttempts network errors", async () => {
    const networkError = new TypeError("fetch failed");
    mockFetch
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(networkError);

    const promise = fetchWithRetry("http://example.com/api", undefined, {
      maxAttempts: 2,
    });

    // Catch the rejection early so Node doesn't flag it as unhandled
    const settled = promise.catch(() => {});

    await vi.advanceTimersByTimeAsync(500);
    await settled;

    await expect(promise).rejects.toThrow("fetch failed");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  // ── AbortError ──────────────────────────────────────────────────────

  it("does NOT retry AbortError — rethrows immediately", async () => {
    const abortError = new DOMException("The operation was aborted", "AbortError");
    mockFetch.mockRejectedValueOnce(abortError);

    await expect(
      fetchWithRetry("http://example.com/api"),
    ).rejects.toThrow(abortError);

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  // ── Custom retryableStatuses ────────────────────────────────────────

  it("uses custom retryableStatuses when provided", async () => {
    const res418 = mockResponse(418);
    const okRes = mockResponse(200);
    mockFetch.mockResolvedValueOnce(res418).mockResolvedValueOnce(okRes);

    const promise = fetchWithRetry("http://example.com/api", undefined, {
      retryableStatuses: [418],
    });

    await vi.advanceTimersByTimeAsync(500);

    const result = await promise;
    expect(result).toBe(okRes);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("does not retry 500 when custom retryableStatuses excludes it", async () => {
    const res500 = mockResponse(500);
    mockFetch.mockResolvedValue(res500);

    const result = await fetchWithRetry("http://example.com/api", undefined, {
      retryableStatuses: [429],
    });

    expect(result.status).toBe(500);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  // ── Exponential backoff ─────────────────────────────────────────────

  it("uses exponential backoff delay pattern (baseDelay * 2^(attempt-1))", async () => {
    const res503 = mockResponse(503);
    const okRes = mockResponse(200);
    mockFetch
      .mockResolvedValueOnce(res503)  // attempt 1 -> delay 500ms
      .mockResolvedValueOnce(res503)  // attempt 2 -> delay 1000ms
      .mockResolvedValueOnce(okRes);  // attempt 3

    const promise = fetchWithRetry("http://example.com/api", undefined, {
      maxAttempts: 4,
      baseDelayMs: 500,
    });

    // After first failure: 500ms delay (500 * 2^0)
    expect(mockFetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(500);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // After second failure: 1000ms delay (500 * 2^1)
    await vi.advanceTimersByTimeAsync(1000);
    expect(mockFetch).toHaveBeenCalledTimes(3);

    const result = await promise;
    expect(result).toBe(okRes);
  });

  // ── Custom maxAttempts ──────────────────────────────────────────────

  it("respects custom maxAttempts", async () => {
    const res500 = mockResponse(500);
    mockFetch.mockResolvedValue(res500);

    const promise = fetchWithRetry("http://example.com/api", undefined, {
      maxAttempts: 5,
    });

    // Advance through all retry delays: 500 + 1000 + 2000 + 4000
    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(4000);

    const result = await promise;
    expect(result.status).toBe(500);
    expect(mockFetch).toHaveBeenCalledTimes(5);
  });

  // ── Custom baseDelayMs ──────────────────────────────────────────────

  it("respects custom baseDelayMs", async () => {
    const res500 = mockResponse(500);
    const okRes = mockResponse(200);
    mockFetch.mockResolvedValueOnce(res500).mockResolvedValueOnce(okRes);

    const promise = fetchWithRetry("http://example.com/api", undefined, {
      baseDelayMs: 1000,
    });

    // First delay should be 1000ms (not 500ms)
    expect(mockFetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(999);
    expect(mockFetch).toHaveBeenCalledTimes(1); // not yet
    await vi.advanceTimersByTimeAsync(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    const result = await promise;
    expect(result).toBe(okRes);
  });

  // ── Default label ───────────────────────────────────────────────────

  it("uses 'fetch' as default label in log messages", async () => {
    const res500 = mockResponse(500);
    const okRes = mockResponse(200);
    mockFetch.mockResolvedValueOnce(res500).mockResolvedValueOnce(okRes);

    const promise = fetchWithRetry("http://example.com/api");

    await vi.advanceTimersByTimeAsync(500);
    await promise;

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("fetch returned 500"),
    );
  });
});
