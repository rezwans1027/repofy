import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { TestProviders } from "@/__tests__/helpers/test-providers";
import { authMockFactory } from "@/__tests__/helpers/mock-auth";

vi.mock("@/components/providers/auth-provider", () => authMockFactory());

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}));
vi.mock("@/lib/api-client", () => ({ api: mockApi, ApiError: Error }));

import { useAdviceList, useAdvice, useExistingAdvice, useDeleteAdvice } from "./use-advice";

describe("useAdviceList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches list of advice entries", async () => {
    const mockAdvice = [
      { id: "adv-1", analyzed_username: "testuser", analyzed_name: "Test", generated_at: "2025-01-15T10:00:00Z" },
    ];
    mockApi.get.mockResolvedValue(mockAdvice);

    const { result } = renderHook(() => useAdviceList(), {
      wrapper: TestProviders,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockAdvice);
  });

  it("returns error when fetch fails", async () => {
    mockApi.get.mockRejectedValue(new Error("API error"));

    const { result } = renderHook(() => useAdviceList(), {
      wrapper: TestProviders,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useAdvice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches single advice by id", async () => {
    const mockAdvice = {
      id: "adv-1",
      analyzed_username: "testuser",
      user_id: "user-123",
      advice_data: { schemaVersion: "v2" },
    };
    mockApi.get.mockResolvedValue(mockAdvice);

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
  });

  it("transitions to error state when fetch fails", async () => {
    mockApi.get.mockRejectedValue(new Error("Not found"));

    const { result } = renderHook(() => useAdvice("adv-1"), {
      wrapper: TestProviders,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useExistingAdvice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when advice exists for username", async () => {
    mockApi.get.mockResolvedValue(true);

    const { result } = renderHook(() => useExistingAdvice("testuser"), {
      wrapper: TestProviders,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(true);
  });

  it("returns false when no advice exists", async () => {
    mockApi.get.mockResolvedValue(false);

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
  });

  it("calls delete with ids and invalidates queries", async () => {
    mockApi.delete.mockResolvedValue(null);

    const { result } = renderHook(() => useDeleteAdvice(), {
      wrapper: TestProviders,
    });

    await result.current.mutateAsync(["adv-1"]);
    expect(mockApi.delete).toHaveBeenCalledWith(
      "/advice",
      expect.objectContaining({ body: { ids: ["adv-1"] } }),
    );
  });

  it("rejects when delete fails", async () => {
    mockApi.delete.mockRejectedValue(new Error("Delete failed"));

    const { result } = renderHook(() => useDeleteAdvice(), {
      wrapper: TestProviders,
    });

    await expect(result.current.mutateAsync(["adv-1"])).rejects.toThrow("Delete failed");
  });
});
