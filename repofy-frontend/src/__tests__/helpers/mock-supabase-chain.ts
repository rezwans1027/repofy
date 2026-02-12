import { vi } from "vitest";

/**
 * Shared chainable Supabase mock for hook tests.
 * Each test file must still call vi.mock("@/lib/supabase/client") with its own
 * factory that returns `{ from: () => mockChain }`, because vi.mock is hoisted.
 */
export const mockChain = {
  select: vi.fn(),
  order: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
  delete: vi.fn(),
  in: vi.fn(),
  limit: vi.fn(),
};

export function setupChain() {
  mockChain.select.mockReturnValue(mockChain);
  mockChain.order.mockReturnValue(mockChain);
  mockChain.eq.mockReturnValue(mockChain);
  mockChain.delete.mockReturnValue(mockChain);
  mockChain.in.mockReturnValue(mockChain);
  mockChain.limit.mockReturnValue(mockChain);
}
