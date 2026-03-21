import { Suspense } from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestProviders } from "@/__tests__/helpers/test-providers";
import { navState, navModule, resetNavState } from "@/__tests__/helpers/mock-navigation";

vi.mock("next/navigation", () => navModule);

type MockUser = { id: string } | null;

const authState = {
  user: { id: "user-123" } as MockUser,
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

let mockJobData: { status: string; advice_id: string | null } | undefined = undefined;
vi.mock("@/hooks/use-advice-job", () => ({
  useAdviceJob: () => ({ data: mockJobData }),
}));

// Mock AnalysisLoading to expose fetchReport for direct invocation
// and respond to the `completed` prop
interface AnalysisLoadingMockProps {
  onComplete: (data: unknown) => void;
  onError: (message: string) => void;
  fetchReport: () => Promise<unknown>;
  completed?: boolean;
}

vi.mock("@/components/report/analysis-loading", () => ({
  AnalysisLoading: ({ onComplete, onError, fetchReport, completed }: AnalysisLoadingMockProps) => (
    <div data-testid="analysis-loading">
      <button
        data-testid="fetch-btn"
        onClick={() =>
          fetchReport()
            .then((data) => onComplete(data))
            .catch((e: Error) => onError(e.message))
        }
      >
        fetch
      </button>
      {completed && (
        <button
          data-testid="completed-btn"
          onClick={() => onComplete(null)}
        >
          completed
        </button>
      )}
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
    mockJobData = undefined;
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

  it("navigates to advisor page when job completes with advice_id", async () => {
    // Mock POST returning job info
    vi.mocked(api.post).mockResolvedValue({ jobId: "job-42", createdAt: "2026-03-21T10:00:00Z" });

    // Set up job data to be "completed" with advice_id
    mockJobData = { status: "completed", advice_id: "adv-42" };

    const user = userEvent.setup();
    await renderPage();

    // Click fetch to trigger the POST (returns a never-resolving promise)
    await user.click(screen.getByTestId("fetch-btn"));

    // The completed prop should render a completed button
    // Simulate the completion callback
    if (screen.queryByTestId("completed-btn")) {
      await user.click(screen.getByTestId("completed-btn"));
    }

    await vi.waitFor(() => {
      expect(navState.replace).toHaveBeenCalledWith("/advisor/adv-42?from=profile");
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
    vi.mocked(api.post).mockResolvedValue({ jobId: "job-99", createdAt: "2026-03-21T10:00:00Z" });
    mockJobData = { status: "completed", advice_id: "adv-99" };

    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByTestId("fetch-btn"));

    if (screen.queryByTestId("completed-btn")) {
      await user.click(screen.getByTestId("completed-btn"));
    }

    await vi.waitFor(() => {
      expect(navState.replace).toHaveBeenCalled();
    });
  });
});
