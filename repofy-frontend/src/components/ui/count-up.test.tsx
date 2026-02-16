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

  describe("with fake timers", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("stays at 0 before intersection is triggered", () => {
      const { container } = render(<CountUp end={500} duration={1000} />);
      vi.advanceTimersByTime(2000);
      const span = container.querySelector("span");
      expect(span!.textContent).toBe("0");
    });

    it("animates to end value after intersection", () => {
      let now = 1000;
      vi.spyOn(Date, "now").mockImplementation(() => now);
      const rafCallbacks: FrameRequestCallback[] = [];
      vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      });

      const { container } = render(<CountUp end={200} duration={1000} />);
      triggerIntersection();
      now = 3000;

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
    });
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
