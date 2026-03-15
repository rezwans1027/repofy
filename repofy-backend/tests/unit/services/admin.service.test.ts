import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/config/supabase", () => ({
  getSupabaseAdmin: vi.fn(),
}));

import { getUsageStats } from "../../../src/services/admin.service";
import { getSupabaseAdmin } from "../../../src/config/supabase";

const mockGetSupabaseAdmin = getSupabaseAdmin as ReturnType<typeof vi.fn>;

function mockSupabase(
  selectResult: { data: unknown; error: unknown },
  countResult: { count: number | null; error: unknown },
) {
  const client = {
    from: vi.fn(),
  };

  // First call: data query
  const dataChain = {
    select: vi.fn().mockReturnValue({
      order: vi.fn().mockReturnValue({
        range: vi.fn().mockResolvedValue(selectResult),
      }),
    }),
  };

  // Second call: count query
  const countChain = {
    select: vi.fn().mockResolvedValue(countResult),
  };

  let callIndex = 0;
  client.from.mockImplementation(() => {
    return callIndex++ === 0 ? dataChain : countChain;
  });

  mockGetSupabaseAdmin.mockReturnValue(client);
  return client;
}

describe("admin.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getUsageStats", () => {
    it("returns paginated summary with correct calculations", async () => {
      const rows = [
        {
          endpoint: "/api/advice",
          model: "gpt-4o",
          prompt_tokens: 100,
          completion_tokens: 200,
          total_tokens: 300,
          estimated_cost: 0.005,
          created_at: "2026-01-01",
        },
        {
          endpoint: "/api/analyze",
          model: "gpt-4o",
          prompt_tokens: 50,
          completion_tokens: 100,
          total_tokens: 150,
          estimated_cost: 0.0025,
          created_at: "2026-01-02",
        },
      ];

      mockSupabase(
        { data: rows, error: null },
        { count: 10, error: null },
      );

      const result = await getUsageStats(1, 10);

      expect(result.summary).toEqual({
        totalRequests: 10,
        recentRequests: 2,
        recentTokens: 450,
        recentCost: "$0.0075",
      });
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        totalPages: 1,
      });
      expect(result.requests).toEqual(rows);
    });

    it("calculates pagination math correctly", async () => {
      mockSupabase(
        { data: [], error: null },
        { count: 25, error: null },
      );

      const result = await getUsageStats(2, 10);

      expect(result.pagination).toEqual({
        page: 2,
        limit: 10,
        totalPages: 3,
      });
    });

    it("handles null estimated_cost values (defaults to 0)", async () => {
      const rows = [
        {
          endpoint: "/api/advice",
          model: "unknown-model",
          prompt_tokens: 100,
          completion_tokens: 200,
          total_tokens: 300,
          estimated_cost: null,
          created_at: "2026-01-01",
        },
      ];

      mockSupabase(
        { data: rows, error: null },
        { count: 1, error: null },
      );

      const result = await getUsageStats(1, 10);

      expect(result.summary.recentCost).toBe("$0.0000");
      expect(result.summary.recentTokens).toBe(300);
    });

    it("handles null/empty data array", async () => {
      mockSupabase(
        { data: null, error: null },
        { count: 0, error: null },
      );

      const result = await getUsageStats(1, 10);

      expect(result.summary.recentRequests).toBe(0);
      expect(result.summary.recentTokens).toBe(0);
      expect(result.summary.recentCost).toBe("$0.0000");
      expect(result.requests).toEqual([]);
    });

    it("uses row count as fallback when count is null", async () => {
      const rows = [
        {
          endpoint: "/api/advice",
          model: "gpt-4o",
          prompt_tokens: 100,
          completion_tokens: 200,
          total_tokens: 300,
          estimated_cost: 0.005,
          created_at: "2026-01-01",
        },
      ];

      mockSupabase(
        { data: rows, error: null },
        { count: null, error: null },
      );

      const result = await getUsageStats(1, 10);

      expect(result.summary.totalRequests).toBe(1);
    });

    it("throws on Supabase select error", async () => {
      mockSupabase(
        { data: null, error: { message: "DB error" } },
        { count: 0, error: null },
      );

      await expect(getUsageStats(1, 10)).rejects.toThrow(
        "Failed to fetch usage data",
      );
    });

    it("throws on Supabase count error", async () => {
      mockSupabase(
        { data: [], error: null },
        { count: null, error: { message: "Count error" } },
      );

      await expect(getUsageStats(1, 10)).rejects.toThrow(
        "Failed to fetch usage data",
      );
    });
  });
});
