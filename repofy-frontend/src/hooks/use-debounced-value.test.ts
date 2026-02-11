import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebouncedValue } from "./use-debounced-value";

describe("useDebouncedValue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns initial value immediately", () => {
    const { result } = renderHook(() => useDebouncedValue("hello", 300));
    expect(result.current).toBe("hello");
  });

  it("updates value after delay", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: "hello", delay: 300 } },
    );

    rerender({ value: "world", delay: 300 });
    // Should still be old value before timer fires
    expect(result.current).toBe("hello");

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe("world");
  });

  it("only emits final value on rapid changes", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: "a", delay: 300 } },
    );

    rerender({ value: "ab", delay: 300 });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    rerender({ value: "abc", delay: 300 });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    rerender({ value: "abcd", delay: 300 });

    // Not enough time has passed for any update
    expect(result.current).toBe("a");

    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Only the final value should be emitted
    expect(result.current).toBe("abcd");
  });

  it("respects different delay values", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: "a", delay: 500 } },
    );

    rerender({ value: "b", delay: 500 });

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe("a");

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe("b");
  });
});
