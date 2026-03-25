import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTypewriter } from "./use-typewriter";

describe("useTypewriter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with empty string", () => {
    const { result } = renderHook(() => useTypewriter(["Hello"]));
    expect(result.current).toBe("");
  });

  it("types out the first word character by character", () => {
    const { result } = renderHook(() => useTypewriter(["Hi"]));

    // Type first character (60ms interval)
    act(() => vi.advanceTimersByTime(60));
    expect(result.current).toBe("H");

    act(() => vi.advanceTimersByTime(60));
    expect(result.current).toBe("Hi");
  });

  it("pauses after typing a full word then starts deleting", () => {
    const { result } = renderHook(() => useTypewriter(["Ab"]));

    // Type "Ab"
    act(() => vi.advanceTimersByTime(60));
    act(() => vi.advanceTimersByTime(60));
    expect(result.current).toBe("Ab");

    // Pause phase (1500ms)
    act(() => vi.advanceTimersByTime(1500));

    // Start deleting (50ms interval)
    act(() => vi.advanceTimersByTime(50));
    expect(result.current).toBe("A");

    act(() => vi.advanceTimersByTime(50));
    expect(result.current).toBe("");
  });

  it("cycles to the next word after deleting", () => {
    const { result } = renderHook(() => useTypewriter(["A", "B"]));

    // Type "A"
    act(() => vi.advanceTimersByTime(60));
    expect(result.current).toBe("A");

    // Pause
    act(() => vi.advanceTimersByTime(1500));

    // Delete "A"
    act(() => vi.advanceTimersByTime(50));
    expect(result.current).toBe("");

    // Start typing next word "B"
    act(() => vi.advanceTimersByTime(60));
    expect(result.current).toBe("B");
  });
});
