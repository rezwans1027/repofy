import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { mockChain, setupChain } from "@/__tests__/helpers/mock-supabase-chain";
import { TestProviders } from "@/__tests__/helpers/test-providers";

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ user: { id: "user-123" }, isLoading: false }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => mockChain,
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  }),
}));

import { useAdviceList, useAdvice, useDeleteAdvice } from "./use-advice";

describe("useAdviceList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupChain();
  });

  it("fetches list of advice entries", async () => {
    const mockAdvice = [
      { id: "adv-1", analyzed_username: "testuser", analyzed_name: "Test", generated_at: "2025-01-15T10:00:00Z" },
    ];
    mockChain.order.mockResolvedValue({ data: mockAdvice, error: null });

    const { result } = renderHook(() => useAdviceList(), {
      wrapper: TestProviders,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockAdvice);
  });

  it("returns error when fetch fails", async () => {
    mockChain.order.mockResolvedValue({
      data: null,
      error: { message: "DB error" },
    });

    const { result } = renderHook(() => useAdviceList(), {
      wrapper: TestProviders,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useAdvice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupChain();
  });

  it("fetches single advice by id", async () => {
    const mockAdvice = {
      id: "adv-1",
      analyzed_username: "testuser",
      user_id: "user-123",
      advice_data: {},
    };
    mockChain.single.mockResolvedValue({ data: mockAdvice, error: null });

    const { result } = renderHook(() => useAdvice("adv-1"), {
      wrapper: TestProviders,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockAdvice);
  });
});

describe("useDeleteAdvice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupChain();
  });

  it("calls delete and invalidates queries", async () => {
    mockChain.in.mockResolvedValue({ error: null });

    const { result } = renderHook(() => useDeleteAdvice(), {
      wrapper: TestProviders,
    });

    await result.current.mutateAsync(["adv-1"]);
    expect(mockChain.delete).toHaveBeenCalled();
  });
});
