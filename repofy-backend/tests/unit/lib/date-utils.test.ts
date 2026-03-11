import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { daysAgo, expiresInMinutes, expiresInDays } from "../../../src/lib/date-utils";

describe("date-utils", () => {
  const NOW = new Date("2025-06-15T12:00:00Z").getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("daysAgo", () => {
    it("returns 0 for today", () => {
      expect(daysAgo("2025-06-15T12:00:00Z")).toBe(0);
    });

    it("returns correct days for past dates", () => {
      expect(daysAgo("2025-06-14T12:00:00Z")).toBe(1);
      expect(daysAgo("2025-06-05T12:00:00Z")).toBe(10);
      expect(daysAgo("2025-01-01T00:00:00Z")).toBe(165);
    });

    it("floors partial days", () => {
      // 1.5 days ago → floors to 1
      expect(daysAgo("2025-06-14T00:00:00Z")).toBe(1);
    });
  });

  describe("expiresInMinutes", () => {
    it("returns ISO string offset by given minutes", () => {
      const result = expiresInMinutes(10);
      const expected = new Date(NOW + 10 * 60_000).toISOString();
      expect(result).toBe(expected);
    });

    it("works with zero", () => {
      const result = expiresInMinutes(0);
      expect(result).toBe(new Date(NOW).toISOString());
    });
  });

  describe("expiresInDays", () => {
    it("returns ISO string offset by given days", () => {
      const result = expiresInDays(1);
      const expected = new Date(NOW + 86_400_000).toISOString();
      expect(result).toBe(expected);
    });

    it("works with multiple days", () => {
      const result = expiresInDays(7);
      const expected = new Date(NOW + 7 * 86_400_000).toISOString();
      expect(result).toBe(expected);
    });
  });
});
