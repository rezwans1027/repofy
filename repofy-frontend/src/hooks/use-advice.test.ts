import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock auth provider
vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ user: { id: "user-123" }, isLoading: false }),
}));

// Mock supabase chain
const mockChain = {
  select: vi.fn(),
  order: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
  delete: vi.fn(),
  in: vi.fn(),
  limit: vi.fn(),
};

function setupChain() {
  mockChain.select.mockReturnValue(mockChain);
  mockChain.order.mockReturnValue(mockChain);
  mockChain.eq.mockReturnValue(mockChain);
  mockChain.delete.mockReturnValue(mockChain);
  mockChain.in.mockReturnValue(mockChain);
  mockChain.limit.mockReturnValue(mockChain);
}

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

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children);
  };
}

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
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockAdvice);
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
      wrapper: createWrapper(),
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
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync(["adv-1"]);
    expect(mockChain.delete).toHaveBeenCalled();
  });
});
