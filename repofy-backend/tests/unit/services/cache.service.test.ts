import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../../src/config/supabase", () => ({
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("../../../src/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("../../../src/lib/date-utils", () => ({
  expiresInDays: vi.fn(() => "2026-03-15T00:00:00.000Z"),
}));

import {
  computeSnapshotHash,
  buildCacheKey,
  clearMemCache,
  getCachedAnalysis,
  setCachedAnalysis,
  cleanExpiredCache,
} from "../../../src/services/cache.service";
import type { CachedAnalysis } from "../../../src/services/cache.service";
import { getSupabaseAdmin } from "../../../src/config/supabase";
import { logger } from "../../../src/lib/logger";
import type { GitHubUserData } from "../../../src/types";

const mockGetSupabaseAdmin = getSupabaseAdmin as ReturnType<typeof vi.fn>;

function makeFakeAnalysis(override?: Partial<CachedAnalysis>): CachedAnalysis {
  return {
    scorerResponse: { radarAxes: [] } as unknown as CachedAnalysis["scorerResponse"],
    scoringResult: { overallScore: 85 } as unknown as CachedAnalysis["scoringResult"],
    narrativeReport: "Test narrative report.",
    ...override,
  };
}

function makeGitHubData(override?: Partial<GitHubUserData>): GitHubUserData {
  return {
    profile: {
      username: "testuser",
      name: "Test",
      avatarUrl: "",
      bio: null,
      company: null,
      location: null,
      blog: null,
      followers: 10,
      following: 5,
      publicRepos: 3,
      createdAt: "2020-01-01T00:00:00Z",
    },
    repositories: [],
    topRepositories: [{ name: "repo-a" }, { name: "repo-b" }] as GitHubUserData["topRepositories"],
    languages: [{ name: "TypeScript", color: "#3178c6", percentage: 80, repoCount: 3 }],
    activity: {
      totalEvents: 100,
      pushEvents: 50,
      prEvents: 25,
      issueEvents: 15,
      reviewEvents: 10,
      recentActiveRepos: [],
    },
    stats: {
      totalStars: 42,
      totalForks: 5,
      originalRepos: 3,
      accountAgeDays: 1000,
      reposTruncated: false,
    },
    contributions: null,
    repoSnapshots: [{ name: "repo-a", fileTree: "src/", hasTests: true }] as GitHubUserData["repoSnapshots"],
    aggregateMetrics: { medianLatestPushDaysAgo: 5, hasCode: true },
    ...override,
  };
}

function mockSupabaseChain(result: { data: unknown; error: unknown }) {
  const chain = {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue(result),
        }),
      }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      delete: vi.fn().mockReturnValue({
        lt: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  };
  mockGetSupabaseAdmin.mockReturnValue(chain);
  return chain;
}

describe("cache.service", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-14T12:00:00Z"));
    clearMemCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── computeSnapshotHash ─────────────────────────────────────────────

  describe("computeSnapshotHash", () => {
    it("returns a deterministic hash for the same input", () => {
      const data = makeGitHubData();
      const hash1 = computeSnapshotHash(data);
      const hash2 = computeSnapshotHash(data);
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[0-9a-f]{64}$/);
    });

    it("returns different hashes for different inputs", () => {
      const data1 = makeGitHubData();
      const data2 = makeGitHubData({
        stats: { totalStars: 999, totalForks: 0, originalRepos: 1, accountAgeDays: 1, reposTruncated: false },
      });
      expect(computeSnapshotHash(data1)).not.toBe(computeSnapshotHash(data2));
    });

    it("returns different hash when repoSnapshots change", () => {
      const data1 = makeGitHubData();
      const data2 = makeGitHubData({
        repoSnapshots: [{ name: "different-repo", fileTree: "lib/", hasTests: false }] as GitHubUserData["repoSnapshots"],
      });
      expect(computeSnapshotHash(data1)).not.toBe(computeSnapshotHash(data2));
    });
  });

  // ── buildCacheKey ───────────────────────────────────────────────────

  describe("buildCacheKey", () => {
    it("returns a deterministic hash", () => {
      const key1 = buildCacheKey("gpt-4", "v1.0", "abc123");
      const key2 = buildCacheKey("gpt-4", "v1.0", "abc123");
      expect(key1).toBe(key2);
      expect(key1).toMatch(/^[0-9a-f]{64}$/);
    });

    it("produces different keys for different models", () => {
      const key1 = buildCacheKey("gpt-4", "v1.0", "abc123");
      const key2 = buildCacheKey("gpt-5", "v1.0", "abc123");
      expect(key1).not.toBe(key2);
    });

    it("produces different keys for different rubric versions", () => {
      const key1 = buildCacheKey("gpt-4", "v1.0", "abc123");
      const key2 = buildCacheKey("gpt-4", "v2.0", "abc123");
      expect(key1).not.toBe(key2);
    });

    it("produces different keys for different snapshot hashes", () => {
      const key1 = buildCacheKey("gpt-4", "v1.0", "hash-a");
      const key2 = buildCacheKey("gpt-4", "v1.0", "hash-b");
      expect(key1).not.toBe(key2);
    });
  });

  // ── clearMemCache ───────────────────────────────────────────────────

  describe("clearMemCache", () => {
    it("clears all entries from the in-memory cache", async () => {
      const analysis = makeFakeAnalysis();
      const supabase = mockSupabaseChain({ data: null, error: null });

      // Populate the mem cache via setCachedAnalysis
      supabase.from.mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      });
      await setCachedAnalysis("key-1", "snap-1", "gpt-4", "v1.0", analysis);

      // Verify it's in memory
      const resultBefore = await getCachedAnalysis("key-1");
      expect(resultBefore).not.toBeNull();

      // Clear and verify it's gone
      clearMemCache();

      // Now getCachedAnalysis should go to Supabase (which returns null)
      mockSupabaseChain({ data: null, error: null });
      const resultAfter = await getCachedAnalysis("key-1");
      expect(resultAfter).toBeNull();
    });
  });

  // ── getCachedAnalysis ───────────────────────────────────────────────

  describe("getCachedAnalysis", () => {
    it("returns from memory cache if available (no Supabase call)", async () => {
      const analysis = makeFakeAnalysis();
      const supabase = mockSupabaseChain({ data: null, error: null });

      // First populate the mem cache via setCachedAnalysis
      supabase.from.mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      });
      await setCachedAnalysis("test-key", "snap", "gpt-4", "v1.0", analysis);

      // Reset mocks to detect if Supabase is called
      vi.clearAllMocks();
      const freshSupabase = mockSupabaseChain({ data: null, error: null });

      const result = await getCachedAnalysis("test-key");
      expect(result).toEqual(analysis);
      // Supabase should NOT have been called since it was in memory
      expect(freshSupabase.from).not.toHaveBeenCalled();
    });

    it("falls back to Supabase when not in memory", async () => {
      const analysis = makeFakeAnalysis();
      const futureDate = "2027-01-01T00:00:00Z";
      mockSupabaseChain({
        data: {
          scorer_response: analysis.scorerResponse,
          scoring_result: analysis.scoringResult,
          narrative_report: analysis.narrativeReport,
          expires_at: futureDate,
        },
        error: null,
      });

      const result = await getCachedAnalysis("db-key");
      expect(result).toEqual(analysis);
    });

    it("returns null for expired DB entries", async () => {
      const analysis = makeFakeAnalysis();
      const pastDate = "2020-01-01T00:00:00Z";
      mockSupabaseChain({
        data: {
          scorer_response: analysis.scorerResponse,
          scoring_result: analysis.scoringResult,
          narrative_report: analysis.narrativeReport,
          expires_at: pastDate,
        },
        error: null,
      });

      const result = await getCachedAnalysis("expired-key");
      expect(result).toBeNull();
    });

    it("returns null when Supabase returns an error", async () => {
      mockSupabaseChain({ data: null, error: { message: "DB error" } });

      const result = await getCachedAnalysis("error-key");
      expect(result).toBeNull();
    });

    it("returns null and logs when Supabase throws", async () => {
      mockGetSupabaseAdmin.mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockRejectedValue(new Error("network failure")),
            }),
          }),
        }),
      });

      const result = await getCachedAnalysis("throw-key");
      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith("Cache lookup failed:", expect.any(Error));
    });

    it("returns null for expired in-memory entries (TTL exceeded)", async () => {
      const analysis = makeFakeAnalysis();
      const supabase = mockSupabaseChain({ data: null, error: null });

      supabase.from.mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      });
      await setCachedAnalysis("ttl-key", "snap", "gpt-4", "v1.0", analysis);

      // Advance time past the 5-minute TTL
      vi.advanceTimersByTime(6 * 60 * 1000);

      // Reset supabase to return null (no DB hit)
      mockSupabaseChain({ data: null, error: null });

      const result = await getCachedAnalysis("ttl-key");
      expect(result).toBeNull();
    });
  });

  // ── setCachedAnalysis ───────────────────────────────────────────────

  describe("setCachedAnalysis", () => {
    it("upserts to Supabase with correct data", async () => {
      const analysis = makeFakeAnalysis();
      const upsertMock = vi.fn().mockResolvedValue({ error: null });
      mockGetSupabaseAdmin.mockReturnValue({
        from: vi.fn().mockReturnValue({ upsert: upsertMock }),
      });

      await setCachedAnalysis("key-1", "snap-hash", "gpt-4", "v1.1", analysis);

      expect(upsertMock).toHaveBeenCalledWith(
        {
          cache_key: "key-1",
          snapshot_hash: "snap-hash",
          model: "gpt-4",
          rubric_version: "v1.1",
          scorer_response: analysis.scorerResponse,
          scoring_result: analysis.scoringResult,
          narrative_report: analysis.narrativeReport,
          expires_at: "2026-03-15T00:00:00.000Z",
        },
        { onConflict: "cache_key" },
      );
    });

    it("writes to memory cache on successful upsert", async () => {
      const analysis = makeFakeAnalysis();
      mockGetSupabaseAdmin.mockReturnValue({
        from: vi.fn().mockReturnValue({
          upsert: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      await setCachedAnalysis("mem-key", "snap", "gpt-4", "v1.0", analysis);

      // Verify it's in memory by reading it back without Supabase
      vi.clearAllMocks();
      const freshSupabase = mockSupabaseChain({ data: null, error: null });

      const result = await getCachedAnalysis("mem-key");
      expect(result).toEqual(analysis);
      expect(freshSupabase.from).not.toHaveBeenCalled();
    });

    it("does NOT write to memory when Supabase returns an error", async () => {
      const analysis = makeFakeAnalysis();
      mockGetSupabaseAdmin.mockReturnValue({
        from: vi.fn().mockReturnValue({
          upsert: vi.fn().mockResolvedValue({ error: { message: "upsert failed" } }),
        }),
      });

      await setCachedAnalysis("fail-key", "snap", "gpt-4", "v1.0", analysis);

      expect(logger.error).toHaveBeenCalledWith("Failed to write analysis cache:", "upsert failed");

      // Verify it's NOT in memory
      vi.clearAllMocks();
      mockSupabaseChain({ data: null, error: null });
      const result = await getCachedAnalysis("fail-key");
      expect(result).toBeNull();
    });

    it("handles Supabase throw gracefully and does not write to memory", async () => {
      const analysis = makeFakeAnalysis();
      mockGetSupabaseAdmin.mockReturnValue({
        from: vi.fn().mockReturnValue({
          upsert: vi.fn().mockRejectedValue(new Error("connection lost")),
        }),
      });

      await setCachedAnalysis("throw-key", "snap", "gpt-4", "v1.0", analysis);

      expect(logger.warn).toHaveBeenCalledWith("Cache write failed:", expect.any(Error));

      // Verify it's NOT in memory
      vi.clearAllMocks();
      mockSupabaseChain({ data: null, error: null });
      const result = await getCachedAnalysis("throw-key");
      expect(result).toBeNull();
    });
  });

  // ── cleanExpiredCache ───────────────────────────────────────────────

  describe("cleanExpiredCache", () => {
    it("calls Supabase delete with expiry filter", async () => {
      const ltMock = vi.fn().mockResolvedValue({ error: null });
      const deleteMock = vi.fn().mockReturnValue({ lt: ltMock });
      mockGetSupabaseAdmin.mockReturnValue({
        from: vi.fn().mockReturnValue({ delete: deleteMock }),
      });

      await cleanExpiredCache();

      expect(deleteMock).toHaveBeenCalled();
      expect(ltMock).toHaveBeenCalledWith("expires_at", expect.any(String));
    });

    it("logs error when Supabase returns an error", async () => {
      const ltMock = vi.fn().mockResolvedValue({ error: { message: "delete failed" } });
      const deleteMock = vi.fn().mockReturnValue({ lt: ltMock });
      mockGetSupabaseAdmin.mockReturnValue({
        from: vi.fn().mockReturnValue({ delete: deleteMock }),
      });

      await cleanExpiredCache();

      expect(logger.error).toHaveBeenCalledWith("Failed to clean expired cache:", "delete failed");
    });

    it("handles Supabase throw gracefully", async () => {
      mockGetSupabaseAdmin.mockReturnValue({
        from: vi.fn().mockReturnValue({
          delete: vi.fn().mockReturnValue({
            lt: vi.fn().mockRejectedValue(new Error("connection error")),
          }),
        }),
      });

      await cleanExpiredCache();

      expect(logger.warn).toHaveBeenCalledWith("Cache cleanup failed:", expect.any(Error));
    });
  });
});
