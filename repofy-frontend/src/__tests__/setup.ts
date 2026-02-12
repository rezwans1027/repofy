import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { vi } from "vitest";

// Ensure DOM cleanup between tests (vitest doesn't auto-cleanup like jest)
afterEach(() => {
  cleanup();
});

// Set Supabase env vars before any module loads
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fake-anon-key";

// Mock next/navigation globally
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useParams: () => ({}),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}));

// Mock next-themes
vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "dark", setTheme: vi.fn() }),
  ThemeProvider: ({ children }: any) => children,
}));

// Mock framer-motion globally. Individual test files can opt out with
// `vi.unmock("framer-motion")` if they need to test animation behavior.
vi.mock("framer-motion", async () => {
  const React = await import("react");

  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop: string) {
      return React.forwardRef((props: any, ref: any) => {
        const {
          initial, animate, exit, variants, transition,
          whileHover, whileInView, whileTap, viewport,
          ...rest
        } = props;
        return React.createElement(prop, { ...rest, ref });
      });
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

// Mock react-type-animation
vi.mock("react-type-animation", () => ({
  TypeAnimation: (props: any) => {
    const React = require("react");
    return React.createElement(props.wrapper || "span", {}, "mocked-type-animation");
  },
}));

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
