import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useGitHubSearch, useGitHubProfile } from "./use-github";
import { TestProviders } from "@/__tests__/helpers/test-providers";
import { createSearchResultFixture, createProfileFixture } from "@/__tests__/fixtures";

vi.mock("@/lib/api-client", () => ({
  api: {
    get: vi.fn(),
  },
  ApiError: class extends Error {
    constructor(message: string, public status: number) {
      super(message);
    }
  },
}));

// Import after mock
import { api } from "@/lib/api-client";

describe("useGitHubSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns search results when query is provided", async () => {
    const mockResults = [createSearchResultFixture()];
    vi.mocked(api.get).mockResolvedValue(mockResults);

    const { result } = renderHook(() => useGitHubSearch("testuser"), {
      wrapper: TestProviders,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockResults);
    expect(api.get).toHaveBeenCalledWith(
      expect.stringContaining("/github/search?q=testuser"),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("does not fetch when query is empty", () => {
    const { result } = renderHook(() => useGitHubSearch(""), {
      wrapper: TestProviders,
    });

    expect(result.current.isFetching).toBe(false);
    expect(api.get).not.toHaveBeenCalled();
  });

  it("does not fetch when query is only whitespace", () => {
    const { result } = renderHook(() => useGitHubSearch("   "), {
      wrapper: TestProviders,
    });

    expect(result.current.isFetching).toBe(false);
  });
});

describe("useGitHubProfile", () => {
  it("returns profile data when username is provided", async () => {
    const mockProfile = createProfileFixture();
    vi.mocked(api.get).mockResolvedValue(mockProfile);

    const { result } = renderHook(() => useGitHubProfile("testuser"), {
      wrapper: TestProviders,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockProfile);
  });

  it("does not fetch when username is empty", () => {
    const { result } = renderHook(() => useGitHubProfile(""), {
      wrapper: TestProviders,
    });

    expect(result.current.isFetching).toBe(false);
  });
});
