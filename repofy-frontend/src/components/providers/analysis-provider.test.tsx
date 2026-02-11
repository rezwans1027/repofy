import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent, cleanup } from "@testing-library/react";
import { AnalysisProvider, useAnalysis } from "./analysis-provider";

function TestConsumer() {
  const { state, startAnalysis, reset } = useAnalysis();
  return (
    <div>
      <span data-testid="username">{state.username}</span>
      <span data-testid="analyzing">{String(state.isAnalyzing)}</span>
      <span data-testid="complete">{String(state.isComplete)}</span>
      <button data-testid="start-btn" onClick={() => startAnalysis("testuser")}>Start</button>
      <button data-testid="reset-btn" onClick={reset}>Reset</button>
    </div>
  );
}

describe("AnalysisProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("provides initial state", () => {
    render(
      <AnalysisProvider>
        <TestConsumer />
      </AnalysisProvider>,
    );

    expect(screen.getByTestId("username").textContent).toBe("");
    expect(screen.getByTestId("analyzing").textContent).toBe("false");
    expect(screen.getByTestId("complete").textContent).toBe("false");
  });

  it("startAnalysis sets isAnalyzing to true", () => {
    render(
      <AnalysisProvider>
        <TestConsumer />
      </AnalysisProvider>,
    );

    fireEvent.click(screen.getByTestId("start-btn"));

    expect(screen.getByTestId("username").textContent).toBe("testuser");
    expect(screen.getByTestId("analyzing").textContent).toBe("true");
    expect(screen.getByTestId("complete").textContent).toBe("false");
  });

  it("sets isComplete after timeout", () => {
    render(
      <AnalysisProvider>
        <TestConsumer />
      </AnalysisProvider>,
    );

    fireEvent.click(screen.getByTestId("start-btn"));

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByTestId("analyzing").textContent).toBe("false");
    expect(screen.getByTestId("complete").textContent).toBe("true");
  });

  it("reset clears state", () => {
    render(
      <AnalysisProvider>
        <TestConsumer />
      </AnalysisProvider>,
    );

    fireEvent.click(screen.getByTestId("start-btn"));

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    fireEvent.click(screen.getByTestId("reset-btn"));

    expect(screen.getByTestId("username").textContent).toBe("");
    expect(screen.getByTestId("analyzing").textContent).toBe("false");
    expect(screen.getByTestId("complete").textContent).toBe("false");
  });

  it("throws when useAnalysis is used outside provider", () => {
    vi.useRealTimers(); // Restore real timers for this one
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow(
      "useAnalysis must be used within AnalysisProvider",
    );
    consoleError.mockRestore();
  });
});
