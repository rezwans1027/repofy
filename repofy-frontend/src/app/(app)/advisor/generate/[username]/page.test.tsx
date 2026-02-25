import { Suspense } from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestProviders } from "@/__tests__/helpers/test-providers";
import { navState, navModule, resetNavState } from "@/__tests__/helpers/mock-navigation";

vi.mock("next/navigation", () => navModule);

const authState = {
  user: { id: "user-123" } as any,
  isLoading: false,
};
vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({
    user: authState.user,
    isLoading: authState.isLoading,
  }),
}));

vi.mock("@/lib/api-client", () => {
  class ApiError extends Error {
    constructor(message: string, public status: number) {
      super(message);
      this.name = "ApiError";
    }
  }
  return {
    api: { post: vi.fn() },
    ApiError,
  };
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      upsert: () => ({
        select: () => ({
          single: () => ({ data: { id: "adv1" }, error: null }),
        }),
      }),
      insert: () => ({
        select: () => ({
          single: () => ({ data: { id: "adv1" }, error: null }),
        }),
      }),
      delete: () => ({
        eq: () => ({
          eq: () => ({
            neq: () => ({ error: null }),
          }),
        }),
      }),
    }),
  }),
}));

// Mock AnalysisLoading to expose fetchReport for direct invocation
vi.mock("@/components/report/analysis-loading", () => ({
  AnalysisLoading: ({ onComplete, onError, fetchReport }: any) => (
    <div data-testid="analysis-loading">
      <button
        data-testid="fetch-btn"
        onClick={() =>
          fetchReport()
            .then((data: any) => onComplete(data))
            .catch((e: Error) => onError(e.message))
        }
      >
        fetch
      </button>
    </div>
  ),
}));

import GenerateAdvicePage from "./page";
import { api, ApiError } from "@/lib/api-client";

async function renderPage() {
  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <TestProviders>
        <Suspense fallback={<div>loading suspense</div>}>
          <GenerateAdvicePage params={Promise.resolve({ username: "testuser" })} />
        </Suspense>
      </TestProviders>,
    );
  });
  return result!;
}

describe("GenerateAdvicePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetNavState();
    authState.user = { id: "user-123" };
    authState.isLoading = false;
  });

  it("renders back link to /profile/{username}", async () => {
    await renderPage();

    const link = screen.getByText("back to profile");
    expect(link.closest("a")).toHaveAttribute("href", "/profile/testuser");
  });

  it("renders AnalysisLoading component", async () => {
    await renderPage();

    expect(screen.getByTestId("analysis-loading")).toBeInTheDocument();
  });

  it("shows error card when user is not logged in on complete", async () => {
    authState.user = null;

    vi.mocked(api.post).mockResolvedValue({
      analyzedName: "Test",
      advice: { summary: "Good" },
    });

    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByTestId("fetch-btn"));

    expect(
      await screen.findByText("You must be logged in to generate advice."),
    ).toBeInTheDocument();
  });

  it("navigates to advisor page on success", async () => {
    vi.mocked(api.post).mockResolvedValue({
      analyzedName: "Test User",
      advice: { summary: "Good profile" },
    });

    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByTestId("fetch-btn"));

    await vi.waitFor(() => {
      expect(navState.replace).toHaveBeenCalledWith("/advisor/adv1?from=profile");
    });
  });

  it("shows no-credits error with Buy Credits link on 402", async () => {
    vi.mocked(api.post).mockRejectedValue(
      new ApiError("Insufficient growth credits", 402),
    );

    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByTestId("fetch-btn"));

    expect(
      await screen.findByText(/don't have any growth credits/),
    ).toBeInTheDocument();

    const buyLink = screen.getByText("Buy Credits");
    expect(buyLink.closest("a")).toHaveAttribute("href", "/pricing");

    // "Try again" should NOT be present for no-credits
    expect(screen.queryByText("Try again")).not.toBeInTheDocument();
  });

  it("shows generic error with Try again button on non-402 error", async () => {
    vi.mocked(api.post).mockRejectedValue(new Error("Server error"));

    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByTestId("fetch-btn"));

    expect(
      await screen.findByText("Server error"),
    ).toBeInTheDocument();

    expect(screen.getByText("Try again")).toBeInTheDocument();

    // "Buy Credits" should NOT be present for generic errors
    expect(screen.queryByText("Buy Credits")).not.toBeInTheDocument();
  });

  it("invalidates credit balance on successful advice generation", async () => {
    vi.mocked(api.post).mockResolvedValue({
      analyzedName: "Test User",
      advice: { summary: "Good" },
    });

    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByTestId("fetch-btn"));

    await vi.waitFor(() => {
      expect(navState.replace).toHaveBeenCalled();
    });
  });
});
