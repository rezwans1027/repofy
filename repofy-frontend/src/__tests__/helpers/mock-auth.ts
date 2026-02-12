import { vi } from "vitest";

/**
 * Shared auth mock factory for vi.mock("@/components/providers/auth-provider", ...).
 *
 * Usage: vi.mock("@/components/providers/auth-provider", () => authMockFactory());
 */
export function authMockFactory(user = { id: "user-123" }, isLoading = false) {
  return {
    useAuth: () => ({ user, isLoading }),
  };
}
