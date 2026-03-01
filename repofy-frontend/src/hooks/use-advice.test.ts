import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { mockChain, setupChain } from "@/__tests__/helpers/mock-supabase-chain";
import { TestProviders } from "@/__tests__/helpers/test-providers";
import { authMockFactory } from "@/__tests__/helpers/mock-auth";
import { supabaseClientMockFactory } from "@/__tests__/helpers/mock-supabase-client";

vi.mock("@/components/providers/auth-provider", () => authMockFactory());
vi.mock("@/lib/supabase/client", () => supabaseClientMockFactory());

import { useAdviceList, useAdvice, useExistingAdvice, useDeleteAdvice } from "./use-advice";

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
      advice_data: { schemaVersion: "v2" },
    };
    mockChain.single.mockResolvedValue({ data: mockAdvice, error: null });

    const { result } = renderHook(() => useAdvice("adv-1"), {
      wrapper: TestProviders,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockAdvice);
  });
});

describe("useAdvice - errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupChain();
  });

  it("transitions to error state when fetch fails", async () => {
    mockChain.single.mockResolvedValue({
      data: null,
      error: { message: "Not found" },
    });

    const { result } = renderHook(() => useAdvice("adv-1"), {
      wrapper: TestProviders,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useExistingAdvice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupChain();
  });

  it("returns true when advice exists for username", async () => {
    mockChain.limit.mockResolvedValue({
      data: [{ id: "adv-1" }],
      error: null,
    });

    const { result } = renderHook(() => useExistingAdvice("testuser"), {
      wrapper: TestProviders,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(true);
  });

  it("returns false when no advice exists", async () => {
    mockChain.limit.mockResolvedValue({
      data: [],
      error: null,
    });

    const { result } = renderHook(() => useExistingAdvice("testuser"), {
      wrapper: TestProviders,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(false);
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
    expect(mockChain.in).toHaveBeenCalledWith("id", ["adv-1"]);
  });

  it("rejects when delete fails", async () => {
    mockChain.in.mockResolvedValue({
      error: { message: "Delete failed" },
    });

    const { result } = renderHook(() => useDeleteAdvice(), {
      wrapper: TestProviders,
    });

    await expect(result.current.mutateAsync(["adv-1"])).rejects.toThrow("Delete failed");
  });
});

