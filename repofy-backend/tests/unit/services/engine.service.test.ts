import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/lib/retry", () => ({
  fetchWithRetry: vi.fn(),
}));

vi.mock("../../../src/config/env", () => ({
  env: {
    engineUrl: "http://localhost:3002",
    engineInternalKey: "test-internal-key",
    dailyAiSpendingCap: 50,
    maxEnginePayloadBytes: 2 * 1024 * 1024,
  },
}));

vi.mock("../../../src/lib/validators", () => ({
  validateSafeUrl: vi.fn((url: string) => new URL(url)),
}));

vi.mock("../../../src/lib/usage-logger", () => ({
  checkSpendingCap: vi.fn(),
}));

import { callEngine } from "../../../src/services/engine.service";
import { fetchWithRetry } from "../../../src/lib/retry";
import { validateSafeUrl } from "../../../src/lib/validators";
import { checkSpendingCap } from "../../../src/lib/usage-logger";

const mockFetchWithRetry = fetchWithRetry as ReturnType<typeof vi.fn>;
const mockValidateSafeUrl = validateSafeUrl as ReturnType<typeof vi.fn>;
const mockCheckSpendingCap = checkSpendingCap as ReturnType<typeof vi.fn>;

function mockOkResponse(data: unknown): Partial<Response> {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
  };
}

function mockErrorResponse(status: number, body: string): Partial<Response> {
  return {
    ok: false,
    status,
    text: vi.fn().mockResolvedValue(body),
  };
}

describe("engine.service — callEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateSafeUrl.mockImplementation((url: string) => new URL(url));
    mockCheckSpendingCap.mockResolvedValue(true);
  });

  // ── Path validation ─────────────────────────────────────────────────

  describe("path validation", () => {
    it("rejects disallowed path /evil", async () => {
      await expect(callEngine("/evil", {})).rejects.toThrow(
        'Engine: disallowed path "/evil"',
      );
      expect(mockFetchWithRetry).not.toHaveBeenCalled();
    });

    it("rejects disallowed path /unknown", async () => {
      await expect(callEngine("/unknown", {})).rejects.toThrow(
        'Engine: disallowed path "/unknown"',
      );
    });

    it("rejects empty path", async () => {
      await expect(callEngine("", {})).rejects.toThrow(
        'Engine: disallowed path ""',
      );
    });

    it("accepts /analyze", async () => {
      mockFetchWithRetry.mockResolvedValue(mockOkResponse({ ok: true }));
      await expect(callEngine("/analyze", {})).resolves.toEqual({ ok: true });
    });

    it("accepts /advice", async () => {
      mockFetchWithRetry.mockResolvedValue(mockOkResponse({ result: "advice" }));
      await expect(callEngine("/advice", {})).resolves.toEqual({ result: "advice" });
    });
  });

  // ── Correct fetch call ──────────────────────────────────────────────

  describe("fetch call", () => {
    it("calls fetchWithRetry with correct URL, method, headers, and body", async () => {
      const body = { username: "octocat", model: "gpt-4" };
      mockFetchWithRetry.mockResolvedValue(mockOkResponse({ score: 85 }));

      await callEngine("/analyze", body);

      expect(mockValidateSafeUrl).toHaveBeenCalledWith(
        "http://localhost:3002/analyze",
        "Engine /analyze",
        { allowedSchemes: ["http", "https"] },
      );

      expect(mockFetchWithRetry).toHaveBeenCalledWith(
        "http://localhost:3002/analyze",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Internal-Key": "test-internal-key",
          },
          body: JSON.stringify(body),
          signal: undefined,
        },
        { label: "Engine /analyze" },
      );
    });

    it("passes through the AbortSignal", async () => {
      const controller = new AbortController();
      mockFetchWithRetry.mockResolvedValue(mockOkResponse({}));

      await callEngine("/analyze", {}, controller.signal);

      expect(mockFetchWithRetry).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ signal: controller.signal }),
        expect.any(Object),
      );
    });
  });

  // ── Success response ────────────────────────────────────────────────

  describe("success response", () => {
    it("returns parsed JSON on success", async () => {
      const responseData = { overallScore: 92, level: "Senior" };
      mockFetchWithRetry.mockResolvedValue(mockOkResponse(responseData));

      const result = await callEngine<{ overallScore: number; level: string }>(
        "/analyze",
        { username: "test" },
      );

      expect(result).toEqual(responseData);
    });
  });

  // ── Error responses ─────────────────────────────────────────────────

  describe("error responses", () => {
    it("throws with status on non-ok response", async () => {
      mockFetchWithRetry.mockResolvedValue(
        mockErrorResponse(500, "Internal Server Error"),
      );

      await expect(callEngine("/analyze", {})).rejects.toThrow(
        "Engine /analyze failed: 500",
      );
    });

    it("throws with status 422", async () => {
      mockFetchWithRetry.mockResolvedValue(
        mockErrorResponse(422, "Invalid username"),
      );

      await expect(callEngine("/advice", {})).rejects.toThrow(
        "Engine /advice failed: 422",
      );
    });

    it("throws with status when text() fails on error response", async () => {
      const errorResponse: Partial<Response> = {
        ok: false,
        status: 503,
        text: vi.fn().mockRejectedValue(new Error("stream closed")),
      };
      mockFetchWithRetry.mockResolvedValue(errorResponse);

      await expect(callEngine("/analyze", {})).rejects.toThrow(
        "Engine /analyze failed: 503",
      );
    });
  });
});
