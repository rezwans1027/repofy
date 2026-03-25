import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFlagTypewriter } from "./use-flag-typewriter";

describe("useFlagTypewriter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with empty text when inactive", () => {
    const { result } = renderHook(() => useFlagTypewriter(" --verify", false));
    expect(result.current.text).toBe("");
    expect(result.current.showCursor).toBe(false);
  });

  it("types forward when active", () => {
    const { result } = renderHook(() => useFlagTypewriter(" --v", true));

    act(() => vi.advanceTimersByTime(60));
    expect(result.current.text).toBe(" ");
    expect(result.current.showCursor).toBe(true);

    act(() => vi.advanceTimersByTime(60));
    expect(result.current.text).toBe(" -");

    act(() => vi.advanceTimersByTime(60));
    expect(result.current.text).toBe(" --");

    act(() => vi.advanceTimersByTime(60));
    expect(result.current.text).toBe(" --v");
    expect(result.current.showCursor).toBe(false); // fully typed
  });

  it("deletes backward when deactivated", () => {
    const { result, rerender } = renderHook(
      ({ active }) => useFlagTypewriter("ab", active),
      { initialProps: { active: true } },
    );

    // Type "ab"
    act(() => vi.advanceTimersByTime(60));
    act(() => vi.advanceTimersByTime(60));
    expect(result.current.text).toBe("ab");

    // Deactivate
    rerender({ active: false });

    // Delete at 40ms interval
    act(() => vi.advanceTimersByTime(40));
    expect(result.current.text).toBe("a");
    expect(result.current.showCursor).toBe(true);

    act(() => vi.advanceTimersByTime(40));
    expect(result.current.text).toBe("");
    expect(result.current.showCursor).toBe(false);
  });
});
