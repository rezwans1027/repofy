import { QueryClient } from "@tanstack/react-query";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: always make a new client
    return makeQueryClient();
  }
  // Browser: singleton
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

/** Drop all cached data — call on sign-out / user switch. */
export function resetQueryClient() {
  browserQueryClient?.clear();
}

// ── Shared stale-time constants ──────────────────────────────────────
export const STALE_SHORT  = 30_000;      // 30s - volatile data (search)
export const STALE_MEDIUM = 120_000;     // 2m  - GitHub profiles
export const STALE_LONG   = 300_000;     // 5m  - saved reports/advice
