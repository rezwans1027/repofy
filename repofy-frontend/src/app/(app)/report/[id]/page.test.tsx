import { Suspense } from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { navState, navModule, resetNavState } from "@/__tests__/helpers/mock-navigation";
import { authMockFactory } from "@/__tests__/helpers/mock-auth";

vi.mock("next/navigation", () => navModule);
vi.mock("@/components/providers/auth-provider", () => authMockFactory());

const reportState = {
  data: null as any,
  isLoading: false,
  error: null as any,
};
vi.mock("@/hooks/use-reports", () => ({
  useReport: () => ({
    data: reportState.data,
    isLoading: reportState.isLoading,
    error: reportState.error,
  }),
}));

// Mock child components
vi.mock("@/components/report/analysis-report", () => ({
  AnalysisReport: ({ username }: any) => (
    <div data-testid="analysis-report">{username}</div>
  ),
}));

import ReportPage from "./page";

async function renderPage() {
  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <Suspense fallback={<div>loading suspense</div>}>
        <ReportPage params={Promise.resolve({ id: "report-1" })} />
      </Suspense>,
    );
  });
  return result!;
}

describe("ReportPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetNavState();
    reportState.data = null;
    reportState.isLoading = false;
    reportState.error = null;
  });

  it("shows loading skeleton when isLoading is true", async () => {
    reportState.isLoading = true;

    const { container } = await renderPage();

    const pulseElements = container.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it("shows error card when error exists", async () => {
    reportState.error = new Error("fail");

    await renderPage();

    expect(screen.getByText("Report not found")).toBeInTheDocument();
  });

  it("shows back link to /reports by default when report is loaded", async () => {
    reportState.data = {
      id: "report-1",
      analyzed_username: "alice",
      report_data: {},
    };

    await renderPage();

    const link = screen.getByText("back to reports");
    expect(link.closest("a")).toHaveAttribute("href", "/reports");
  });

  it("shows back link to /profile/{username} when from=profile", async () => {
    navState.searchParams = new URLSearchParams("from=profile");
    reportState.data = {
      id: "report-1",
      analyzed_username: "alice",
      report_data: {},
    };

    await renderPage();

    const link = screen.getByText("back to profile");
    expect(link.closest("a")).toHaveAttribute("href", "/profile/alice");
  });

  it("renders AnalysisReport when data is loaded", async () => {
    reportState.data = {
      id: "report-1",
      analyzed_username: "alice",
      report_data: { overallScore: 82 },
    };

    await renderPage();

    expect(screen.getByTestId("analysis-report")).toBeInTheDocument();
    expect(screen.getByTestId("analysis-report")).toHaveTextContent("alice");
  });
});
