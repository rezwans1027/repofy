import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/config/supabase", () => ({
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("../../../src/services/credit.service", () => ({
  deductGrowthCredit: vi.fn(),
  refundGrowthCredit: vi.fn(),
}));

vi.mock("../../../src/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { deductAndPersist, InsufficientCreditsError } from "../../../src/services/advice-persistence.service";
import { deductGrowthCredit, refundGrowthCredit } from "../../../src/services/credit.service";
import { getSupabaseAdmin } from "../../../src/config/supabase";
import { DatabaseError } from "../../../src/lib/errors";
import type { AdviceData } from "../../../src/types/shared/advice";

const mockDeductGrowthCredit = deductGrowthCredit as ReturnType<typeof vi.fn>;
const mockRefundGrowthCredit = refundGrowthCredit as ReturnType<typeof vi.fn>;
const mockGetSupabaseAdmin = getSupabaseAdmin as ReturnType<typeof vi.fn>;

// ── Fixtures ─────────────────────────────────────────────────────────

const USER_ID = "user-123";
const REQUEST_ID = "req-abc";
const USERNAME = "octocat";
const DISPLAY_NAME = "The Octocat";
const ADVICE_ID = "advice-uuid-1";

const fakeAdviceData: AdviceData = {
  schemaVersion: "v2",
  generationWarnings: [],
  summary: "Great profile.",
  trajectory: {
    currentEstimate: "Mid-Level",
    targetEstimate: "Senior",
    confidence: "High",
    rationale: "Strong signal.",
    calibration: {
      complexity: "High",
      breadth: "Wide",
      collaboration: "Active",
      engineeringPractices: "Strong",
      consistency: "Steady",
    },
  },
  buildRoadmap: [],
  skillRoadmap: [],
  repoImprovements: [],
  contributionStrategy: [],
  profileOptimizations: [],
  weeklyRoadmap: [],
  strengthsAndGaps: { strengths: [], gaps: [] },
  careerPositioning: { positioning: "Full-stack", roles: [], differentiators: [] },
  successMetrics: [],
};

// ── Helpers ──────────────────────────────────────────────────────────

function mockSupabaseInsertSuccess(id = ADVICE_ID) {
  const singleFn = vi.fn().mockResolvedValue({ data: { id }, error: null });
  const selectFn = vi.fn().mockReturnValue({ single: singleFn });
  const insertFn = vi.fn().mockReturnValue({ select: selectFn });
  const fromFn = vi.fn().mockReturnValue({ insert: insertFn });

  mockGetSupabaseAdmin.mockReturnValue({ from: fromFn });

  return { fromFn, insertFn, selectFn, singleFn };
}

function mockSupabaseInsertError(error: Error) {
  const singleFn = vi.fn().mockResolvedValue({ data: null, error });
  const selectFn = vi.fn().mockReturnValue({ single: singleFn });
  const insertFn = vi.fn().mockReturnValue({ select: selectFn });
  const fromFn = vi.fn().mockReturnValue({ insert: insertFn });

  mockGetSupabaseAdmin.mockReturnValue({ from: fromFn });

  return { fromFn, insertFn, selectFn, singleFn };
}

function mockSupabaseInsertNoData() {
  const singleFn = vi.fn().mockResolvedValue({ data: null, error: null });
  const selectFn = vi.fn().mockReturnValue({ single: singleFn });
  const insertFn = vi.fn().mockReturnValue({ select: selectFn });
  const fromFn = vi.fn().mockReturnValue({ insert: insertFn });

  mockGetSupabaseAdmin.mockReturnValue({ from: fromFn });

  return { fromFn, insertFn, selectFn, singleFn };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("advice-persistence.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("deductAndPersist", () => {
    // ── Success path ───────────────────────────────────────────────

    it("deducts credit, persists advice via insert, and returns the advice id", async () => {
      mockDeductGrowthCredit.mockResolvedValue(true);
      const { fromFn, insertFn } = mockSupabaseInsertSuccess();

      const id = await deductAndPersist(USER_ID, REQUEST_ID, USERNAME, DISPLAY_NAME, fakeAdviceData);

      expect(id).toBe(ADVICE_ID);

      // Verify credit deduction was called with correct params
      expect(mockDeductGrowthCredit).toHaveBeenCalledWith(USER_ID, REQUEST_ID, {
        username: USERNAME,
        endpoint: "/advice",
      });

      // Verify insert was called on the correct table (not upsert)
      expect(fromFn).toHaveBeenCalledWith("advice");
      expect(insertFn).toHaveBeenCalledWith({
        user_id: USER_ID,
        analyzed_username: USERNAME,
        analyzed_name: DISPLAY_NAME,
        advice_data: fakeAdviceData,
      });
    });

    it("works when analyzedName is null", async () => {
      mockDeductGrowthCredit.mockResolvedValue(true);
      const { insertFn } = mockSupabaseInsertSuccess();

      const id = await deductAndPersist(USER_ID, REQUEST_ID, USERNAME, null, fakeAdviceData);

      expect(id).toBe(ADVICE_ID);
      expect(insertFn).toHaveBeenCalledWith(
        expect.objectContaining({ analyzed_name: null }),
      );
    });

    // ── Failure: insufficient credits (deductGrowthCredit returns false) ─

    it("throws InsufficientCreditsError when deductGrowthCredit returns false", async () => {
      mockDeductGrowthCredit.mockResolvedValue(false);
      mockSupabaseInsertSuccess(); // should never be reached

      await expect(
        deductAndPersist(USER_ID, REQUEST_ID, USERNAME, DISPLAY_NAME, fakeAdviceData),
      ).rejects.toThrow(InsufficientCreditsError);

      await expect(
        deductAndPersist(USER_ID, REQUEST_ID, USERNAME, DISPLAY_NAME, fakeAdviceData),
      ).rejects.toThrow("Insufficient growth credits");
    });

    it("does not call supabase when credit deduction fails", async () => {
      mockDeductGrowthCredit.mockResolvedValue(false);
      const { fromFn } = mockSupabaseInsertSuccess();

      await expect(
        deductAndPersist(USER_ID, REQUEST_ID, USERNAME, DISPLAY_NAME, fakeAdviceData),
      ).rejects.toThrow(InsufficientCreditsError);

      expect(fromFn).not.toHaveBeenCalled();
    });

    // ── Failure: deductGrowthCredit itself throws (RPC/network error) ────

    it("propagates error when deductGrowthCredit throws", async () => {
      mockDeductGrowthCredit.mockRejectedValue(new Error("RPC timeout"));

      await expect(
        deductAndPersist(USER_ID, REQUEST_ID, USERNAME, DISPLAY_NAME, fakeAdviceData),
      ).rejects.toThrow("RPC timeout");
    });

    it("does not persist when deductGrowthCredit throws", async () => {
      mockDeductGrowthCredit.mockRejectedValue(new Error("RPC timeout"));
      const { fromFn } = mockSupabaseInsertSuccess();

      await expect(
        deductAndPersist(USER_ID, REQUEST_ID, USERNAME, DISPLAY_NAME, fakeAdviceData),
      ).rejects.toThrow();

      expect(fromFn).not.toHaveBeenCalled();
    });

    // ── Failure: persistence error (DB write fails after deduction) ──────

    it("throws DatabaseError when insert returns an error", async () => {
      mockDeductGrowthCredit.mockResolvedValue(true);
      mockSupabaseInsertError(new Error("constraint violation"));

      await expect(
        deductAndPersist(USER_ID, REQUEST_ID, USERNAME, DISPLAY_NAME, fakeAdviceData),
      ).rejects.toThrow(DatabaseError);

      await expect(
        deductAndPersist(USER_ID, REQUEST_ID, USERNAME, DISPLAY_NAME, fakeAdviceData),
      ).rejects.toThrow("Database operation failed: persist advice");
    });

    it("refunds credit when persistence fails", async () => {
      mockDeductGrowthCredit.mockResolvedValue(true);
      mockRefundGrowthCredit.mockResolvedValue(true);
      mockSupabaseInsertError(new Error("constraint violation"));

      await expect(
        deductAndPersist(USER_ID, REQUEST_ID, USERNAME, DISPLAY_NAME, fakeAdviceData),
      ).rejects.toThrow();

      expect(mockRefundGrowthCredit).toHaveBeenCalledWith(USER_ID, REQUEST_ID, {
        reason: "persist_failed",
        username: USERNAME,
      });
    });

    // ── Failure: insert succeeds but returns no id ───────────────────────

    it("throws DatabaseError and refunds when insert returns no id", async () => {
      mockDeductGrowthCredit.mockResolvedValue(true);
      mockRefundGrowthCredit.mockResolvedValue(true);
      mockSupabaseInsertNoData();

      await expect(
        deductAndPersist(USER_ID, REQUEST_ID, USERNAME, DISPLAY_NAME, fakeAdviceData),
      ).rejects.toThrow(DatabaseError);

      expect(mockRefundGrowthCredit).toHaveBeenCalledWith(USER_ID, REQUEST_ID, {
        reason: "persist_failed",
        username: USERNAME,
      });
    });

    // ── Edge: InsufficientCreditsError properties ────────────────────────

    it("InsufficientCreditsError has correct name property", () => {
      const err = new InsufficientCreditsError();
      expect(err.name).toBe("InsufficientCreditsError");
      expect(err.message).toBe("Insufficient growth credits");
      expect(err).toBeInstanceOf(Error);
    });
  });
});
