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

import { useActiveAdviceJob, useAdviceJob } from "./use-advice-job";

describe("useActiveAdviceJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches the active job", async () => {
    const job = {
      id: "job-1",
      user_id: "user-123",
      analyzed_username: "testuser",
      status: "processing",
      advice_id: null,
      error: null,
      created_at: "2025-06-01T12:00:00Z",
      updated_at: "2025-06-01T12:00:00Z",
    };
    mockApi.get.mockResolvedValue(job);

    const { result } = renderHook(() => useActiveAdviceJob(), {
      wrapper: TestProviders,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(job);
    expect(mockApi.get).toHaveBeenCalledWith(
      "/advice/jobs/active",
      expect.any(Object),
    );
  });

  it("returns null when no active job", async () => {
    mockApi.get.mockResolvedValue(null);

    const { result } = renderHook(() => useActiveAdviceJob(), {
      wrapper: TestProviders,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });
});

describe("useAdviceJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches a specific job by ID", async () => {
    const job = {
      id: "job-2",
      user_id: "user-123",
      analyzed_username: "testuser",
      status: "completed",
      advice_id: "adv-1",
      error: null,
      created_at: "2025-06-01T12:00:00Z",
      updated_at: "2025-06-01T12:01:00Z",
    };
    mockApi.get.mockResolvedValue(job);

    const { result } = renderHook(() => useAdviceJob("job-2"), {
      wrapper: TestProviders,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(job);
    expect(mockApi.get).toHaveBeenCalledWith(
      "/advice/jobs/job-2",
      expect.any(Object),
    );
  });

  it("does not fetch when jobId is null", () => {
    const { result } = renderHook(() => useAdviceJob(null), {
      wrapper: TestProviders,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockApi.get).not.toHaveBeenCalled();
  });
});
