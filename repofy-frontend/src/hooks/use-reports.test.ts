import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { mockChain, setupChain } from "@/__tests__/helpers/mock-supabase-chain";
import { TestProviders } from "@/__tests__/helpers/test-providers";
import { createReportListItemFixture } from "@/__tests__/fixtures";

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

import { useReports, useReport, useDeleteReports } from "./use-reports";

describe("useReports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupChain();
  });

  it("fetches list of reports", async () => {
    const mockReports = [
      createReportListItemFixture(),
      createReportListItemFixture({ id: "report-2", analyzed_username: "user2" }),
    ];
    mockChain.order.mockResolvedValue({ data: mockReports, error: null });

    const { result } = renderHook(() => useReports(), {
      wrapper: TestProviders,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockReports);
  });

  it("returns error when fetch fails", async () => {
    mockChain.order.mockResolvedValue({
      data: null,
      error: { message: "DB error" },
    });

    const { result } = renderHook(() => useReports(), {
      wrapper: TestProviders,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupChain();
  });

  it("fetches a single report by id", async () => {
    const mockReport = {
      id: "report-1",
      analyzed_username: "testuser",
      report_data: {},
    };
    mockChain.single.mockResolvedValue({ data: mockReport, error: null });

    const { result } = renderHook(() => useReport("report-1"), {
      wrapper: TestProviders,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockReport);
  });
});

describe("useDeleteReports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupChain();
  });

  it("calls delete on supabase with ids", async () => {
    mockChain.in.mockResolvedValue({ error: null });

    const { result } = renderHook(() => useDeleteReports(), {
      wrapper: TestProviders,
    });

    await result.current.mutateAsync(["report-1", "report-2"]);
    expect(mockChain.delete).toHaveBeenCalled();
  });
});
