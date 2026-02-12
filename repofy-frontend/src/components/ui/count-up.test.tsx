import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { CountUp } from "./count-up";

// --- IntersectionObserver override for CountUp tests ---
let observerCallback: IntersectionObserverCallback;

class TestableIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();

  constructor(cb: IntersectionObserverCallback) {
    observerCallback = cb;
  }
}

function triggerIntersection() {
  act(() => {
    observerCallback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
  });
}

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", TestableIntersectionObserver);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CountUp", () => {
  it("renders initial count of 0", () => {
    const { container } = render(<CountUp end={100} />);
    const span = container.querySelector("span");
    expect(span).toBeInTheDocument();
    expect(span!.textContent).toBe("0");
  });

  it("renders prefix and suffix", () => {
    const { container } = render(
      <CountUp end={100} prefix="$" suffix="%" />,
    );
    const span = container.querySelector("span");
    expect(span!.textContent).toBe("$0%");
  });

  it("stays at 0 before intersection is triggered", () => {
    vi.useFakeTimers();
    const { container } = render(<CountUp end={500} duration={1000} />);

    // Advance time without triggering intersection
    vi.advanceTimersByTime(2000);

    const span = container.querySelector("span");
    expect(span!.textContent).toBe("0");

    vi.useRealTimers();
  });

  it("animates to end value after intersection", () => {
    vi.useFakeTimers();

    // Mock Date.now to control animation timing
    let now = 1000;
    vi.spyOn(Date, "now").mockImplementation(() => now);

    // Collect rAF callbacks so we can flush them manually
    const rafCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });

    const { container } = render(<CountUp end={200} duration={1000} />);

    // Trigger intersection - this sets hasStarted=true and causes
    // the animation effect to call requestAnimationFrame
    triggerIntersection();

    // Jump Date.now well past the animation duration
    now = 3000;

    // Flush all queued rAF callbacks (there may be a chain of them)
    // Run in a loop since each step() might enqueue another rAF
    let safety = 0;
    while (rafCallbacks.length > 0 && safety < 100) {
      const cb = rafCallbacks.shift()!;
      act(() => {
        cb(0);
      });
      safety++;
    }

    const span = container.querySelector("span");
    expect(Number(span!.textContent)).toBe(200);

    vi.useRealTimers();
  });

  it("applies custom className", () => {
    const { container } = render(
      <CountUp end={50} className="text-cyan-400" />,
    );
    const span = container.querySelector("span");
    expect(span!.className).toContain("text-cyan-400");
    // Also retains base classes
    expect(span!.className).toContain("font-mono");
    expect(span!.className).toContain("tabular-nums");
  });
});
