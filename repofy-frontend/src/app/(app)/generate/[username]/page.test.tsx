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

vi.mock("@/lib/api-client", () => ({
  api: { post: vi.fn() },
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      upsert: () => ({
        select: () => ({
          single: () => ({ data: { id: "r1" }, error: null }),
        }),
      }),
      insert: () => ({
        select: () => ({
          single: () => ({ data: { id: "r1" }, error: null }),
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

// Mock child components
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

import GeneratePage from "./page";
import { api } from "@/lib/api-client";

async function renderPage() {
  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <TestProviders>
        <Suspense fallback={<div>loading suspense</div>}>
          <GeneratePage params={Promise.resolve({ username: "testuser" })} />
        </Suspense>
      </TestProviders>,
    );
  });
  return result!;
}

describe("GeneratePage", () => {
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
      report: { overallScore: 80, recommendation: "Hire" },
    });

    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByTestId("fetch-btn"));

    expect(
      await screen.findByText("You must be logged in to generate a report."),
    ).toBeInTheDocument();
  });

  it("navigates to report page on success", async () => {
    vi.mocked(api.post).mockResolvedValue({
      analyzedName: "Test User",
      report: { overallScore: 82, recommendation: "Strong Hire" },
    });

    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByTestId("fetch-btn"));

    await vi.waitFor(() => {
      expect(navState.replace).toHaveBeenCalledWith("/report/r1?from=profile");
    });
  });

  it('shows "back to profile" label', async () => {
    await renderPage();

    expect(screen.getByText("back to profile")).toBeInTheDocument();
  });
});
