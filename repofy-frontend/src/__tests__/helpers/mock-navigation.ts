import { vi } from "vitest";

/**
 * Shared next/navigation mock for vi.mock("next/navigation", ...).
 *
 * Mutate `navState` between renders to change pathname, router fns, etc.
 *
 * Usage:
 *   import { navState, navModule } from "@/__tests__/helpers/mock-navigation";
 *   vi.mock("next/navigation", () => navModule);
 */
export const navState = {
  pathname: "/",
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
  params: {} as Record<string, string>,
  searchParams: new URLSearchParams(),
};

export const navModule = {
  useRouter: () => ({
    push: navState.push,
    replace: navState.replace,
    back: navState.back,
    refresh: navState.refresh,
    prefetch: navState.prefetch,
  }),
  usePathname: () => navState.pathname,
  useParams: () => navState.params,
  useSearchParams: () => navState.searchParams,
  redirect: vi.fn(),
};

/** Reset navState to defaults — call in afterEach. */
export function resetNavState() {
  navState.pathname = "/";
  navState.push.mockReset();
  navState.replace.mockReset();
  navState.back.mockReset();
  navState.refresh.mockReset();
  navState.prefetch.mockReset();
  navState.params = {};
  navState.searchParams = new URLSearchParams();
}
