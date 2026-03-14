import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock next/navigation — redirect() throws in real Next.js to halt execution
const mockRedirect = vi.fn(() => { throw new Error("NEXT_REDIRECT"); });
vi.mock("next/navigation", () => ({
  redirect: (...args: any[]) => mockRedirect(...args),
}));

// Mock server-api
const mockServerFetch = vi.fn();
vi.mock("@/lib/server-api", () => ({
  serverFetch: (...args: any[]) => mockServerFetch(...args),
}));

// Mock child components
vi.mock("@/components/report/analysis-report", () => ({
  AnalysisReport: ({ username, data }: any) => (
    <div data-testid="analysis-report" data-username={username} data-score={data?.overallScore}>
      {username}
    </div>
  ),
}));

vi.mock("@/components/ui/back-link", () => ({
  BackLink: ({ href, label }: any) => <a href={href}>{label}</a>,
}));

vi.mock("@/components/ui/error-card", () => ({
  ErrorCard: ({ message }: any) => <div>{message}</div>,
}));

import ReportPage from "./page";

async function renderPage(id = "report-1", from?: string) {
  const params = Promise.resolve({ id });
  const searchParams = Promise.resolve(from ? { from } : {});
  const Component = await ReportPage({ params, searchParams });
  render(Component);
}

describe("ReportPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockServerFetch.mockResolvedValue({ data: null, error: "not-found" });
  });

  it("shows error card when report is not found", async () => {
    mockServerFetch.mockResolvedValue({ data: null, error: "not-found" });

    await renderPage();

    expect(screen.getByText("Report not found")).toBeInTheDocument();
  });

  it("shows access denied when forbidden", async () => {
    mockServerFetch.mockResolvedValue({ data: null, error: "forbidden" });

    await renderPage();

    expect(screen.getByText("Access denied")).toBeInTheDocument();
  });

  it("shows server error message", async () => {
    mockServerFetch.mockResolvedValue({ data: null, error: "server-error" });

    await renderPage();

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("redirects to login when unauthenticated", async () => {
    mockServerFetch.mockResolvedValue({ data: null, error: "unauthenticated" });

    await expect(renderPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });

  it("shows back link to /reports by default when report is loaded", async () => {
    mockServerFetch.mockResolvedValue({
      data: { id: "report-1", analyzed_username: "alice", report_data: {} },
      error: null,
    });

    await renderPage();

    const link = screen.getByText("back to reports");
    expect(link.closest("a")).toHaveAttribute("href", "/reports");
  });

  it("shows back link to /profile/{username} when from=profile", async () => {
    mockServerFetch.mockResolvedValue({
      data: { id: "report-1", analyzed_username: "alice", report_data: {} },
      error: null,
    });

    await renderPage("report-1", "profile");

    const link = screen.getByText("back to profile");
    expect(link.closest("a")).toHaveAttribute("href", "/profile/alice");
  });

  it("renders AnalysisReport when data is loaded", async () => {
    mockServerFetch.mockResolvedValue({
      data: { id: "report-1", analyzed_username: "alice", report_data: { overallScore: 82 } },
      error: null,
    });

    await renderPage();

    expect(screen.getByTestId("analysis-report")).toBeInTheDocument();
    expect(screen.getByTestId("analysis-report")).toHaveTextContent("alice");
  });

  it("passes correct props to AnalysisReport", async () => {
    mockServerFetch.mockResolvedValue({
      data: { id: "report-1", analyzed_username: "alice", report_data: { overallScore: 82 } },
      error: null,
    });

    await renderPage();

    const el = screen.getByTestId("analysis-report");
    expect(el).toHaveAttribute("data-username", "alice");
    expect(el).toHaveAttribute("data-score", "82");
  });

  it("calls serverFetch with correct path", async () => {
    mockServerFetch.mockResolvedValue({ data: null, error: "not-found" });

    await renderPage("abc-123");

    expect(mockServerFetch).toHaveBeenCalledWith("/reports/abc-123", { revalidate: 3600 });
  });
});
