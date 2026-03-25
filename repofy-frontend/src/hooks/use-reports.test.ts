import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { TestProviders } from "@/__tests__/helpers/test-providers";
import { createReportListItemFixture } from "@/__tests__/fixtures";
import { authMockFactory } from "@/__tests__/helpers/mock-auth";

vi.mock("@/components/providers/auth-provider", () => authMockFactory());

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}));
vi.mock("@/lib/api-client", () => ({ api: mockApi, ApiError: Error }));

import { useReports, useReport, useDeleteReports } from "./use-reports";

describe("useReports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches list of reports", async () => {
    const mockReports = [
      createReportListItemFixture(),
      createReportListItemFixture({ id: "report-2", analyzed_username: "user2" }),
    ];
    mockApi.get.mockResolvedValue(mockReports);

    const { result } = renderHook(() => useReports(), {
      wrapper: TestProviders,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockReports);
  });

  it("returns error when fetch fails", async () => {
    mockApi.get.mockRejectedValue(new Error("API error"));

    const { result } = renderHook(() => useReports(), {
      wrapper: TestProviders,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches a single report by id", async () => {
    const mockReport = {
      id: "report-1",
      analyzed_username: "testuser",
      report_data: {},
    };
    mockApi.get.mockResolvedValue(mockReport);

    const { result } = renderHook(() => useReport("report-1"), {
      wrapper: TestProviders,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockReport);
  });
});

describe("useReport - errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("transitions to error state when fetch fails", async () => {
    mockApi.get.mockRejectedValue(new Error("Not found"));

    const { result } = renderHook(() => useReport("report-1"), {
      wrapper: TestProviders,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useDeleteReports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls delete with ids", async () => {
    mockApi.delete.mockResolvedValue(null);

    const { result } = renderHook(() => useDeleteReports(), {
      wrapper: TestProviders,
    });

    await result.current.mutateAsync(["report-1", "report-2"]);
    expect(mockApi.delete).toHaveBeenCalledWith(
      "/reports",
      expect.objectContaining({ body: { ids: ["report-1", "report-2"] } }),
    );
  });

  it("rejects when delete fails", async () => {
    mockApi.delete.mockRejectedValue(new Error("Delete failed"));

    const { result } = renderHook(() => useDeleteReports(), {
      wrapper: TestProviders,
    });

    await expect(result.current.mutateAsync(["report-1"])).rejects.toThrow("Delete failed");
  });
});
