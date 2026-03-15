import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/lib/redis", () => ({
  getRedis: vi.fn(),
}));

vi.mock("../../../src/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { advisoryLock } from "../../../src/lib/distributed-lock";
import { getRedis } from "../../../src/lib/redis";
import { logger } from "../../../src/lib/logger";

const mockGetRedis = getRedis as ReturnType<typeof vi.fn>;

function createMockRedis() {
  return {
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(1),
  };
}

describe("advisoryLock", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Clean up any local locks from previous tests by releasing known keys
    mockGetRedis.mockReturnValue(null);
    await advisoryLock.release("test-key");
    await advisoryLock.release("key-a");
    await advisoryLock.release("key-b");
    await advisoryLock.release("local-key");
    await advisoryLock.release("redis-key");
    await advisoryLock.release("fail-key");
    await advisoryLock.release("check-key");
    await advisoryLock.release("release-key");
    await advisoryLock.release("idempotent-key");
    vi.clearAllMocks();
  });

  // ── With Redis available ────────────────────────────────────────────

  describe("with Redis available", () => {
    it("acquire calls redis.set with NX and EX flags", async () => {
      const redis = createMockRedis();
      mockGetRedis.mockReturnValue(redis);

      const result = await advisoryLock.acquire("test-key", 600);

      expect(result).toBe(true);
      expect(redis.set).toHaveBeenCalledWith(
        "repofy:lock:test-key",
        expect.any(String),
        "EX",
        600,
        "NX",
      );
    });

    it("acquire returns true when Redis SET returns OK", async () => {
      const redis = createMockRedis();
      redis.set.mockResolvedValue("OK");
      mockGetRedis.mockReturnValue(redis);

      expect(await advisoryLock.acquire("key-a", 300)).toBe(true);
    });

    it("acquire returns false when Redis SET returns null (lock already held)", async () => {
      const redis = createMockRedis();
      redis.set.mockResolvedValue(null);
      mockGetRedis.mockReturnValue(redis);

      expect(await advisoryLock.acquire("key-b", 300)).toBe(false);
    });

    it("release calls redis.del with prefixed key", async () => {
      const redis = createMockRedis();
      mockGetRedis.mockReturnValue(redis);

      await advisoryLock.release("release-key");

      expect(redis.del).toHaveBeenCalledWith("repofy:lock:release-key");
    });

    it("isHeld calls redis.exists and returns true when key exists", async () => {
      const redis = createMockRedis();
      redis.exists.mockResolvedValue(1);
      mockGetRedis.mockReturnValue(redis);

      expect(await advisoryLock.isHeld("check-key")).toBe(true);
      expect(redis.exists).toHaveBeenCalledWith("repofy:lock:check-key");
    });

    it("isHeld returns false when Redis says key does not exist", async () => {
      const redis = createMockRedis();
      redis.exists.mockResolvedValue(0);
      mockGetRedis.mockReturnValue(redis);

      expect(await advisoryLock.isHeld("check-key")).toBe(false);
    });
  });

  // ── Redis unavailable (getRedis returns null) ───────────────────────

  describe("Redis unavailable (getRedis returns null)", () => {
    beforeEach(() => {
      mockGetRedis.mockReturnValue(null);
    });

    it("acquire uses local map and returns true", async () => {
      expect(await advisoryLock.acquire("local-key", 300)).toBe(true);
    });

    it("acquire returns false when lock already held locally", async () => {
      await advisoryLock.acquire("local-key", 300);
      expect(await advisoryLock.acquire("local-key", 300)).toBe(false);
    });

    it("release cleans local map so lock can be re-acquired", async () => {
      await advisoryLock.acquire("local-key", 300);
      await advisoryLock.release("local-key");
      expect(await advisoryLock.acquire("local-key", 300)).toBe(true);
    });

    it("isHeld returns true when lock is held locally", async () => {
      await advisoryLock.acquire("local-key", 300);
      expect(await advisoryLock.isHeld("local-key")).toBe(true);
    });

    it("isHeld returns false when no local lock exists", async () => {
      expect(await advisoryLock.isHeld("local-key")).toBe(false);
    });
  });

  // ── Redis throws (fallback to in-memory) ────────────────────────────

  describe("Redis throws (fallback to in-memory)", () => {
    it("acquire falls back to in-memory when redis.set throws", async () => {
      const redis = createMockRedis();
      redis.set.mockRejectedValue(new Error("Redis connection refused"));
      mockGetRedis.mockReturnValue(redis);

      const result = await advisoryLock.acquire("fail-key", 300);

      expect(result).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Redis lock acquire failed for "fail-key"'),
        expect.any(Error),
      );
    });

    it("release logs warning when redis.del throws", async () => {
      const redis = createMockRedis();
      redis.del.mockRejectedValue(new Error("Redis timeout"));
      mockGetRedis.mockReturnValue(redis);

      await advisoryLock.release("fail-key");

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Redis lock release failed for "fail-key"'),
        expect.any(Error),
      );
    });

    it("isHeld falls back to local map when redis.exists throws", async () => {
      // First acquire locally (no redis)
      mockGetRedis.mockReturnValue(null);
      await advisoryLock.acquire("fail-key", 300);

      // Now redis is "available" but throws
      const redis = createMockRedis();
      redis.exists.mockRejectedValue(new Error("Redis error"));
      mockGetRedis.mockReturnValue(redis);

      const result = await advisoryLock.isHeld("fail-key");

      expect(result).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Redis lock check failed for "fail-key"'),
        expect.any(Error),
      );
    });
  });

  // ── Idempotency ─────────────────────────────────────────────────────

  describe("release idempotency", () => {
    it("releasing a non-existent lock does not throw (no Redis)", async () => {
      mockGetRedis.mockReturnValue(null);
      await expect(advisoryLock.release("idempotent-key")).resolves.toBeUndefined();
    });

    it("releasing a non-existent lock does not throw (with Redis)", async () => {
      const redis = createMockRedis();
      redis.del.mockResolvedValue(0);
      mockGetRedis.mockReturnValue(redis);

      await expect(advisoryLock.release("idempotent-key")).resolves.toBeUndefined();
    });
  });
});
