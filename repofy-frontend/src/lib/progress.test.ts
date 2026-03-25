import { describe, it, expect, vi, afterEach } from "vitest";
import { calculateAdviceProgress } from "./progress";

describe("calculateAdviceProgress", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 0 progress at the start", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T12:00:00Z"));

    const result = calculateAdviceProgress("2025-06-01T12:00:00Z");
    expect(result.progress).toBeCloseTo(0, 0);
    expect(result.phaseIndex).toBe(0);
    expect(result.elapsed).toBeCloseTo(0, 0);
  });

  it("returns proportional progress within the first 90 seconds", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T12:00:45Z"));

    const result = calculateAdviceProgress("2025-06-01T12:00:00Z");
    // 45s / 90s * 94 = 47
    expect(result.progress).toBeCloseTo(47, 0);
    expect(result.elapsed).toBeCloseTo(45, 0);
    expect(result.phaseIndex).toBe(4); // floor(45 / 11.25) = 4
  });

  it("reaches ~94% at 90 seconds", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T12:01:30Z"));

    const result = calculateAdviceProgress("2025-06-01T12:00:00Z");
    expect(result.progress).toBeCloseTo(94, 0);
    expect(result.phaseIndex).toBe(7);
  });

  it("slowly increases beyond 94% after 90 seconds", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T12:02:00Z"));

    const result = calculateAdviceProgress("2025-06-01T12:00:00Z");
    // 120s elapsed, 30s past 90: 94 + (30/30) * 4 = 98
    expect(result.progress).toBeCloseTo(98, 0);
    expect(result.phaseIndex).toBe(7);
  });

  it("caps at 98% even after very long elapsed time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T12:10:00Z"));

    const result = calculateAdviceProgress("2025-06-01T12:00:00Z");
    expect(result.progress).toBe(98);
    expect(result.phaseIndex).toBe(7);
  });
});
