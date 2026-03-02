import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/config/supabase", () => ({
  getSupabaseAdmin: vi.fn(),
}));

import {
  getCreditBalance,
  grantGrowthCredits,
  deductGrowthCredit,
} from "../../../src/services/credit.service";
import { getSupabaseAdmin } from "../../../src/config/supabase";

const mockGetSupabaseAdmin = getSupabaseAdmin as ReturnType<typeof vi.fn>;

function mockSupabase(overrides: Record<string, unknown> = {}) {
  const client = {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
    rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
    ...overrides,
  };
  mockGetSupabaseAdmin.mockReturnValue(client);
  return client;
}

describe("credit.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCreditBalance", () => {
    it("returns zeros when no wallet row exists", async () => {
      mockSupabase();
      const result = await getCreditBalance("user-1");
      expect(result).toEqual({ growth_balance: 0, eval_balance: 0 });
    });

    it("returns balance from existing wallet row", async () => {
      const client = mockSupabase();
      client.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { growth_balance: 5, eval_balance: 0 },
              error: null,
            }),
          }),
        }),
      });

      const result = await getCreditBalance("user-1");
      expect(result).toEqual({ growth_balance: 5, eval_balance: 0 });
    });

    it("throws on supabase error", async () => {
      const client = mockSupabase();
      client.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: new Error("DB down"),
            }),
          }),
        }),
      });

      await expect(getCreditBalance("user-1")).rejects.toThrow("DB down");
    });
  });

  describe("grantGrowthCredits", () => {
    it("calls RPC with correct params including metadata", async () => {
      const client = mockSupabase();
      const meta = { stripe_event_id: "evt_123" };

      const result = await grantGrowthCredits("user-1", 2, "pi_123", meta);

      expect(client.rpc).toHaveBeenCalledWith("grant_growth_credits", {
        p_user_id: "user-1",
        p_amount: 2,
        p_stripe_payment_intent_id: "pi_123",
        p_metadata: meta,
      });
      expect(result).toBe(true);
    });

    it("returns false on duplicate (idempotent)", async () => {
      const client = mockSupabase();
      client.rpc.mockResolvedValue({ data: false, error: null });

      const result = await grantGrowthCredits("user-1", 2, "pi_123");
      expect(result).toBe(false);
    });

    it("passes null metadata when not provided", async () => {
      const client = mockSupabase();
      await grantGrowthCredits("user-1", 2, "pi_123");

      expect(client.rpc).toHaveBeenCalledWith("grant_growth_credits", {
        p_user_id: "user-1",
        p_amount: 2,
        p_stripe_payment_intent_id: "pi_123",
        p_metadata: null,
      });
    });

    it("throws on RPC error", async () => {
      const client = mockSupabase();
      client.rpc.mockResolvedValue({ data: null, error: new Error("RPC fail") });

      await expect(grantGrowthCredits("user-1", 2, "pi_123")).rejects.toThrow("RPC fail");
    });
  });

  describe("deductGrowthCredit", () => {
    it("calls RPC with required requestId", async () => {
      const client = mockSupabase();

      const result = await deductGrowthCredit("user-1", "req-abc", { username: "octocat" });

      expect(client.rpc).toHaveBeenCalledWith("deduct_growth_credit", {
        p_user_id: "user-1",
        p_request_id: "req-abc",
        p_metadata: { username: "octocat" },
      });
      expect(result).toBe(true);
    });

    it("returns false when insufficient balance", async () => {
      const client = mockSupabase();
      client.rpc.mockResolvedValue({ data: false, error: null });

      const result = await deductGrowthCredit("user-1", "req-abc");
      expect(result).toBe(false);
    });

    it("throws on RPC error", async () => {
      const client = mockSupabase();
      client.rpc.mockResolvedValue({ data: null, error: new Error("RPC fail") });

      await expect(deductGrowthCredit("user-1", "req-abc")).rejects.toThrow("RPC fail");
    });
  });

});
