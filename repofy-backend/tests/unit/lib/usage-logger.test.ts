import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/config/supabase", () => ({
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("../../../src/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { logTokenUsage } from "../../../src/lib/usage-logger";
import { getSupabaseAdmin } from "../../../src/config/supabase";
import { logger } from "../../../src/lib/logger";

const mockGetSupabaseAdmin = getSupabaseAdmin as ReturnType<typeof vi.fn>;
const mockLogger = logger as { info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

function mockSupabaseInsert(insertResult: { error: unknown } = { error: null }) {
  const insertFn = vi.fn().mockResolvedValue(insertResult);
  const client = {
    from: vi.fn().mockReturnValue({
      insert: insertFn,
    }),
  };
  mockGetSupabaseAdmin.mockReturnValue(client);
  return { client, insertFn };
}

describe("usage-logger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("logTokenUsage", () => {
    it("logs info with token counts for known model", () => {
      mockSupabaseInsert();

      logTokenUsage("/api/advice", "gpt-5.1", {
        prompt_tokens: 1000,
        completion_tokens: 500,
        total_tokens: 1500,
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("prompt: 1000, completion: 500, total: 1500"),
      );
    });

    it("includes estimated cost in log for known models", () => {
      mockSupabaseInsert();

      logTokenUsage("/api/advice", "gpt-5.1", {
        prompt_tokens: 1000,
        completion_tokens: 500,
        total_tokens: 1500,
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("est. cost: $"),
      );
    });

    it("omits cost for unknown model", () => {
      mockSupabaseInsert();

      logTokenUsage("/api/advice", "unknown-model", {
        prompt_tokens: 1000,
        completion_tokens: 500,
        total_tokens: 1500,
      });

      const logMessage = mockLogger.info.mock.calls[0][0] as string;
      expect(logMessage).not.toContain("est. cost");
    });

    it("warns when usage is undefined", () => {
      logTokenUsage("/api/advice", "gpt-5.1", undefined);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "[/api/advice] OpenAI response missing usage data",
      );
      expect(mockLogger.info).not.toHaveBeenCalled();
    });

    it("inserts row to Supabase api_usage table", async () => {
      const { client } = mockSupabaseInsert();

      logTokenUsage("/api/advice", "gpt-5.1", {
        prompt_tokens: 1000,
        completion_tokens: 500,
        total_tokens: 1500,
      });

      // Wait for fire-and-forget promise
      await vi.waitFor(() => {
        expect(client.from).toHaveBeenCalledWith("api_usage");
      });
    });

    it("handles Supabase insert error (logs error, doesn't throw)", async () => {
      mockSupabaseInsert({ error: { message: "Insert failed" } });

      // Should not throw
      logTokenUsage("/api/advice", "gpt-5.1", {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
      });

      await vi.waitFor(() => {
        expect(mockLogger.error).toHaveBeenCalledWith(
          "Failed to persist usage data",
          "Insert failed",
        );
      });
    });

    it("handles Supabase insert promise rejection (logs error)", async () => {
      const client = {
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockRejectedValue(new Error("Network error")),
        }),
      };
      mockGetSupabaseAdmin.mockReturnValue(client);

      logTokenUsage("/api/advice", "gpt-5.1", {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
      });

      await vi.waitFor(() => {
        expect(mockLogger.error).toHaveBeenCalledWith(
          "Unhandled error persisting usage data",
          expect.any(Error),
        );
      });
    });

    it("calculates cost accurately for gpt-5.1 pricing", () => {
      mockSupabaseInsert();

      // gpt-5.1: input=$2/1M, output=$12/1M
      // 1_000_000 prompt tokens = $2.00, 1_000_000 completion tokens = $12.00
      logTokenUsage("/api/advice", "gpt-5.1", {
        prompt_tokens: 1_000_000,
        completion_tokens: 1_000_000,
        total_tokens: 2_000_000,
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("est. cost: $14.0000"),
      );
    });
  });
});
