import "@testing-library/jest-dom/vitest";
import * as axeMatchers from "vitest-axe/matchers";
import type { ElementType, PropsWithChildren } from "react";
import { afterEach, expect } from "vitest";
import { cleanup } from "@testing-library/react";
import { vi } from "vitest";

// Extend Vitest with axe accessibility matchers (toHaveNoViolations)
expect.extend(axeMatchers);
import { navModule } from "./helpers/mock-navigation";

// Ensure DOM cleanup between tests (vitest doesn't auto-cleanup like jest)
afterEach(() => {
  cleanup();
});

// Set Supabase env vars before any module loads
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fake-anon-key";

// Mock next/navigation globally
vi.mock("next/navigation", () => navModule);

// Mock next-themes
vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "dark", setTheme: vi.fn() }),
  ThemeProvider: ({ children }: PropsWithChildren) => children,
}));

// Mock framer-motion globally. Individual test files can opt out with
// `vi.unmock("framer-motion")` if they need to test animation behavior.
vi.mock("framer-motion", async () => {
  const React = await import("react");

  interface MockMotionProps extends React.HTMLAttributes<HTMLElement> {
    children?: React.ReactNode;
    initial?: unknown;
    animate?: unknown;
    exit?: unknown;
    variants?: unknown;
    transition?: unknown;
    whileHover?: unknown;
    whileInView?: unknown;
    whileTap?: unknown;
    viewport?: unknown;
    layout?: unknown;
    layoutId?: string;
  }

  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop: string) {
      const MockMotionComponent = React.forwardRef<HTMLElement, MockMotionProps>(function MockMotionComponent(
        props,
        ref,
      ) {
        const {
          initial: _initial,
          animate: _animate,
          exit: _exit,
          variants: _variants,
          transition: _transition,
          whileHover: _whileHover,
          whileInView: _whileInView,
          whileTap: _whileTap,
          viewport: _viewport,
          layout: _layout,
          layoutId: _layoutId,
          ...rest
        } = props;
        return React.createElement(prop as ElementType, { ...rest, ref });
      });
      MockMotionComponent.displayName = `MockMotion(${prop})`;
      return MockMotionComponent;
    },
  };

  return {
    motion: new Proxy({}, handler),
    AnimatePresence: ({ children }: PropsWithChildren) =>
      React.createElement(React.Fragment, null, children),
    useAnimation: () => ({ start: vi.fn(), stop: vi.fn() }),
    useInView: () => true,
    useMotionValue: (initial: number) => ({
      get: () => initial,
      set: vi.fn(),
    }),
    useTransform: () => ({ get: () => 0 }),
    useScroll: () => ({
      scrollYProgress: { get: () => 0 },
      scrollXProgress: { get: () => 0 },
    }),
    useReducedMotion: () => false,
    MotionConfig: ({ children }: PropsWithChildren) => children,
  };
});

// Mock react-type-animation
vi.mock("react-type-animation", async () => {
  const React = await import("react");

  interface TypeAnimationProps {
    wrapper?: ElementType;
  }

  return {
    TypeAnimation: ({ wrapper: Wrapper = "span" }: TypeAnimationProps) =>
      React.createElement(Wrapper, {}, "mocked-type-animation"),
  };
});

// Stub IntersectionObserver
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

// Stub ResizeObserver
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal("ResizeObserver", MockResizeObserver);
