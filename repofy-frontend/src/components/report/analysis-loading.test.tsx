import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { AnalysisLoading } from "./analysis-loading";

describe("AnalysisLoading", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Mock requestAnimationFrame
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
      return setTimeout(cb, 16) as unknown as number;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders phase text", () => {
    const fetchReport = vi.fn().mockReturnValue(new Promise(() => {}));
    const onComplete = vi.fn();
    const onError = vi.fn();

    render(
      <AnalysisLoading
        fetchReport={fetchReport}
        onComplete={onComplete}
        onError={onError}
      />,
    );

    expect(screen.getByText("Scanning profile...")).toBeInTheDocument();
  });

  it("calls fetchReport on mount", () => {
    const fetchReport = vi.fn().mockReturnValue(new Promise(() => {}));
    const onComplete = vi.fn();
    const onError = vi.fn();

    render(
      <AnalysisLoading
        fetchReport={fetchReport}
        onComplete={onComplete}
        onError={onError}
      />,
    );

    expect(fetchReport).toHaveBeenCalledTimes(1);
  });

  it("calls onComplete when fetch succeeds", async () => {
    const mockData = { report: "data" };
    const fetchReport = vi.fn().mockResolvedValue(mockData);
    const onComplete = vi.fn();
    const onError = vi.fn();

    render(
      <AnalysisLoading
        fetchReport={fetchReport}
        onComplete={onComplete}
        onError={onError}
      />,
    );

    // Wait for fetch to resolve
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    // Advance past MIN_DISPLAY_MS (3000ms) + fade timing (800ms)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    expect(onComplete).toHaveBeenCalledWith(mockData);
    expect(onError).not.toHaveBeenCalled();
  });

  it("calls onError when fetch fails", async () => {
    const fetchReport = vi.fn().mockRejectedValue(new Error("Network failure"));
    const onComplete = vi.fn();
    const onError = vi.fn();

    render(
      <AnalysisLoading
        fetchReport={fetchReport}
        onComplete={onComplete}
        onError={onError}
      />,
    );

    // Wait for fetch to reject
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    // Advance past MIN_DISPLAY_MS
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3500);
    });

    expect(onError).toHaveBeenCalledWith("Network failure");
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("accepts custom phases", () => {
    const customPhases = ["Phase 1...", "Phase 2..."];
    const fetchReport = vi.fn().mockReturnValue(new Promise(() => {}));

    render(
      <AnalysisLoading
        fetchReport={fetchReport}
        onComplete={vi.fn()}
        onError={vi.fn()}
        phases={customPhases}
      />,
    );

    expect(screen.getByText("Phase 1...")).toBeInTheDocument();
  });

  it("renders custom title", () => {
    const fetchReport = vi.fn().mockReturnValue(new Promise(() => {}));

    render(
      <AnalysisLoading
        fetchReport={fetchReport}
        onComplete={vi.fn()}
        onError={vi.fn()}
        title="custom title"
      />,
    );

    expect(screen.getByText("custom title")).toBeInTheDocument();
  });
});
