import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Override the global framer-motion mock with a caching Proxy so that
// motion.div always returns the SAME component reference across re-renders.
// Without this, React sees a new component type each render and unmounts the
// subtree, resetting useState values and breaking fake-timer tests.
vi.mock("framer-motion", async () => {
  const React = await import("react");

  const cache = new Map<string, React.ComponentType<any>>();
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop: string) {
      if (!cache.has(prop)) {
        cache.set(
          prop,
          React.forwardRef((props: any, ref: any) => {
            const {
              initial, animate, exit, variants, transition,
              whileHover, whileInView, whileTap, viewport,
              ...rest
            } = props;
            return React.createElement(prop, { ...rest, ref });
          }),
        );
      }
      return cache.get(prop)!;
    },
  };

  return {
    motion: new Proxy({}, handler),
    AnimatePresence: ({ children }: any) =>
      React.createElement(React.Fragment, null, children),
    useAnimation: () => ({ start: vi.fn(), stop: vi.fn() }),
    useInView: () => true,
    useMotionValue: (initial: number) => ({
      get: () => initial,
      set: vi.fn(),
    }),
    useTransform: () => ({ get: () => 0 }),
  };
});

import { Hero } from "./hero";

describe("Hero", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders section with id='hero'", () => {
    render(<Hero />);
    const section = document.getElementById("hero");
    expect(section).toBeInTheDocument();
    expect(section!.tagName).toBe("SECTION");
  });

  it("renders subtitle text", () => {
    render(<Hero />);
    expect(
      screen.getByText("AI-powered GitHub analysis for technical hiring"),
    ).toBeInTheDocument();
  });

  it("renders terminal prompt", () => {
    render(<Hero />);
    expect(screen.getByText("$ repofy analyze")).toBeInTheDocument();
  });

  it("renders 'Get Started Free' link pointing to /login", () => {
    render(<Hero />);
    const link = screen.getByRole("link", { name: /get started free/i });
    expect(link).toHaveAttribute("href", "/login");
  });

  it("'See How It Works' button scrolls to #features", async () => {
    const scrollIntoView = vi.fn();
    const featuresEl = document.createElement("div");
    featuresEl.id = "features";
    featuresEl.scrollIntoView = scrollIntoView;
    document.body.appendChild(featuresEl);

    render(<Hero />);
    const button = screen.getByRole("button", { name: /see how it works/i });

    const user = userEvent.setup();
    await user.click(button);

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth" });
    document.body.removeChild(featuresEl);
  });

  it("typewriter types first username character by character", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    render(<Hero />);

    const input = document.querySelector("input") as HTMLInputElement;
    expect(input.placeholder).toBe("");

    // "torvalds" has 8 characters - each appears after 120ms
    const username = "torvalds";
    for (let i = 1; i <= username.length; i++) {
      await act(async () => {
        vi.advanceTimersByTime(120);
      });
      expect(input.placeholder).toBe(username.slice(0, i));
    }
  });

  it("typewriter pauses 1500ms then deletes at 50ms intervals", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    render(<Hero />);

    const input = document.querySelector("input") as HTMLInputElement;

    // Type out "torvalds" fully (8 chars, each 120ms)
    for (let i = 0; i < 8; i++) {
      await act(async () => {
        vi.advanceTimersByTime(120);
      });
    }
    expect(input.placeholder).toBe("torvalds");

    // Advance 1500ms: the nested pause timeout fires, switching to delete mode.
    // One extra typing tick (120ms < 1500ms) runs during the pause, pushing
    // charIndex from 8 to 9 (placeholder stays "torvalds" since slice beyond
    // string length is harmless).
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    expect(input.placeholder).toBe("torvalds");

    // First delete tick: charIndex 9 -> 8, slice(0,8) = "torvalds" (no visible change)
    await act(async () => {
      vi.advanceTimersByTime(50);
    });
    expect(input.placeholder).toBe("torvalds");

    // Second delete tick: charIndex 8 -> 7, slice(0,7) = "torvald"
    await act(async () => {
      vi.advanceTimersByTime(50);
    });
    expect(input.placeholder).toBe("torvald");

    // Third delete tick: charIndex 7 -> 6, slice(0,6) = "torval"
    await act(async () => {
      vi.advanceTimersByTime(50);
    });
    expect(input.placeholder).toBe("torval");
  });

  it("renders trust line", () => {
    render(<Hero />);
    expect(screen.getByText(/free during beta/i)).toBeInTheDocument();
  });
});
