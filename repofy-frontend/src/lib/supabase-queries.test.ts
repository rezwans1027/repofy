import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { TestProviders } from "@/__tests__/helpers/test-providers";
import { mockChain, setupChain } from "@/__tests__/helpers/mock-supabase-chain";

// Stable mock state — allows per-test auth toggling
const authState = { user: null as { id: string } | null };

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ user: authState.user }),
}));

const mockFrom = vi.fn().mockReturnValue(mockChain);

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ from: mockFrom }),
}));

import { createSupabaseQueries } from "./supabase-queries";

const { useList, useById, useExisting, useDelete } = createSupabaseQueries<
  { id: string; name: string },
  { id: string; name: string; detail: string }
>({
  table: "test_table",
  queryKeyPrefix: "test",
  listSelect: "id,name",
  detailSelect: "*",
});

describe("createSupabaseQueries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupChain();
    authState.user = { id: "user-1" };
  });

  describe("useList", () => {
    it("returns list data when user is authenticated", async () => {
      const mockData = [{ id: "1", name: "Item 1" }];
      // order() is the last chained call before the query resolves
      mockChain.order.mockResolvedValue({ data: mockData, error: null });

      const { result } = renderHook(() => useList(), {
        wrapper: TestProviders,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockData);
      expect(mockFrom).toHaveBeenCalledWith("test_table");
    });

    it("does not fetch when user is not authenticated", () => {
      authState.user = null;

      const { result } = renderHook(() => useList(), {
        wrapper: TestProviders,
      });

      expect(result.current.isFetching).toBe(false);
    });

    it("throws on supabase error", async () => {
      mockChain.order.mockResolvedValue({
        data: null,
        error: { message: "DB error" },
      });

      const { result } = renderHook(() => useList(), {
        wrapper: TestProviders,
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useById", () => {
    it("returns detail data for a given id", async () => {
      const mockDetail = { id: "1", name: "Item 1", detail: "Full detail" };
      mockChain.single.mockResolvedValue({ data: mockDetail, error: null });

      const { result } = renderHook(() => useById("1"), {
        wrapper: TestProviders,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockDetail);
    });

    it("does not fetch when id is empty", () => {
      const { result } = renderHook(() => useById(""), {
        wrapper: TestProviders,
      });

      expect(result.current.isFetching).toBe(false);
    });

    it("transitions to error state on failure", async () => {
      mockChain.single.mockResolvedValue({
        data: null,
        error: { message: "Not found" },
      });

      const { result } = renderHook(() => useById("999"), {
        wrapper: TestProviders,
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useExisting", () => {
    it("returns true when record exists", async () => {
      mockChain.limit.mockResolvedValue({
        data: [{ id: "1" }],
        error: null,
      });

      const { result } = renderHook(() => useExisting("testuser"), {
        wrapper: TestProviders,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBe(true);
    });

    it("returns false when record does not exist", async () => {
      mockChain.limit.mockResolvedValue({ data: [], error: null });

      const { result } = renderHook(() => useExisting("nobody"), {
        wrapper: TestProviders,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBe(false);
    });

    it("transitions to error state on failure", async () => {
      mockChain.limit.mockResolvedValue({
        data: null,
        error: { message: "Query failed" },
      });

      const { result } = renderHook(() => useExisting("testuser"), {
        wrapper: TestProviders,
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useDelete", () => {
    it("deletes records by ids", async () => {
      mockChain.in.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useDelete(), {
        wrapper: TestProviders,
      });

      await result.current.mutateAsync(["1", "2"]);
      expect(mockFrom).toHaveBeenCalledWith("test_table");
      expect(mockChain.delete).toHaveBeenCalled();
      expect(mockChain.in).toHaveBeenCalledWith("id", ["1", "2"]);
    });

    it("rejects when delete returns an error", async () => {
      mockChain.in.mockResolvedValue({
        error: { message: "Delete failed" },
      });

      const { result } = renderHook(() => useDelete(), {
        wrapper: TestProviders,
      });

      await expect(result.current.mutateAsync(["1"])).rejects.toThrow("Delete failed");
    });
  });
});
