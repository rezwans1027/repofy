import { vi } from "vitest";
import { mockChain } from "./mock-supabase-chain";

/**
 * Shared Supabase client mock factory for vi.mock("@/lib/supabase/client", ...).
 *
 * Returns a mock that provides the chainable query builder via mockChain,
 * plus basic auth stubs (getUser, onAuthStateChange).
 *
 * Usage: vi.mock("@/lib/supabase/client", () => supabaseClientMockFactory());
 */
export function supabaseClientMockFactory() {
  return {
    createClient: () => ({
      from: () => mockChain,
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
      },
    }),
  };
}
