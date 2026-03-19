import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { TestProviders } from "@/__tests__/helpers/test-providers";

type MockUser = { id: string } | null;

const mockUser = vi.hoisted(() => ({ current: { id: "user-123" } as MockUser }));

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ user: mockUser.current, isLoading: false }),
}));

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}));
vi.mock("@/lib/api-client", () => ({ api: mockApi, ApiError: Error }));

import { useCreditBalance, useAwaitCreditUpdate } from "./use-credits";

describe("useCreditBalance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.current = { id: "user-123" };
  });

  it("fetches credit balance when user exists", async () => {
    const balance = { growth_balance: 5, eval_balance: 3 };
    mockApi.get.mockResolvedValue(balance);

    const { result } = renderHook(() => useCreditBalance(), {
      wrapper: TestProviders,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(balance);
    expect(mockApi.get).toHaveBeenCalledWith(
      "/credits/balance",
      expect.objectContaining({ auth: true }),
    );
  });

  it("is disabled when no user", () => {
    mockUser.current = null;

    const { result } = renderHook(() => useCreditBalance(), {
      wrapper: TestProviders,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockApi.get).not.toHaveBeenCalled();
  });
});

describe("useAwaitCreditUpdate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.current = { id: "user-123" };
  });

  it("is disabled when enabled=false", () => {
    const { result } = renderHook(
      () => useAwaitCreditUpdate(false, 5),
      { wrapper: TestProviders },
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockApi.get).not.toHaveBeenCalled();
  });

  it("is disabled when no user", () => {
    mockUser.current = null;

    const { result } = renderHook(
      () => useAwaitCreditUpdate(true, 5),
      { wrapper: TestProviders },
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockApi.get).not.toHaveBeenCalled();
  });

  it("is disabled when initialBalance is undefined", () => {
    const { result } = renderHook(
      () => useAwaitCreditUpdate(true, undefined),
      { wrapper: TestProviders },
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockApi.get).not.toHaveBeenCalled();
  });

  it("is enabled when all conditions are met", async () => {
    const balance = { growth_balance: 5, eval_balance: 3 };
    mockApi.get.mockResolvedValue(balance);

    const { result } = renderHook(
      () => useAwaitCreditUpdate(true, 3),
      { wrapper: TestProviders },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.get).toHaveBeenCalledWith(
      "/credits/balance",
      expect.objectContaining({ auth: true }),
    );
  });
});
