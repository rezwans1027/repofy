import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createReportListItemFixture } from "@/__tests__/fixtures";

// Mock auth
vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ user: { id: "user-123" }, isLoading: false }),
}));

// Mock useReports and useDeleteReports
let mockReportsData: any[] = [];
const mockDeleteMutateAsync = vi.fn().mockResolvedValue(undefined);
vi.mock("@/hooks/use-reports", () => ({
  useReports: () => ({
    data: mockReportsData,
    isLoading: false,
  }),
  useDeleteReports: () => ({
    mutateAsync: mockDeleteMutateAsync,
    isPending: false,
  }),
}));

// Mock styles
vi.mock("@/lib/styles", () => ({
  recommendationStyle: () => "mock-style",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/reports",
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));

import ReportsPage from "./page";

describe("ReportsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReportsData = [];
  });

  it("shows empty state when no reports exist", () => {
    render(<ReportsPage />);
    expect(screen.getByText("No reports yet")).toBeInTheDocument();
    expect(screen.getByText("Go to search")).toBeInTheDocument();
  });

  it("renders report table when reports exist", () => {
    mockReportsData = [
      createReportListItemFixture({
        id: "r1",
        analyzed_username: "alice",
        analyzed_name: "Alice Dev",
        overall_score: 85,
        recommendation: "Strong Hire",
        generated_at: "2025-01-15T10:00:00Z",
      }),
      createReportListItemFixture({
        id: "r2",
        analyzed_username: "bob",
        analyzed_name: "Bob Coder",
        overall_score: 62,
        recommendation: "Hire",
        generated_at: "2025-01-14T10:00:00Z",
      }),
    ];

    render(<ReportsPage />);

    expect(screen.getByText("Reports")).toBeInTheDocument();
    expect(screen.getByText("@alice")).toBeInTheDocument();
    expect(screen.getByText("@bob")).toBeInTheDocument();
    expect(screen.getByText("85")).toBeInTheDocument();
    expect(screen.getByText("62")).toBeInTheDocument();
  });

  it("renders search input for filtering", () => {
    mockReportsData = [createReportListItemFixture()];

    render(<ReportsPage />);
    const searchInput = screen.getByPlaceholderText("Search…");
    expect(searchInput).toBeInTheDocument();
  });

  it("filters reports by search query", async () => {
    mockReportsData = [
      createReportListItemFixture({ id: "r1", analyzed_username: "alice" }),
      createReportListItemFixture({ id: "r2", analyzed_username: "bob" }),
    ];

    const user = userEvent.setup();
    render(<ReportsPage />);

    await user.type(screen.getByPlaceholderText("Search…"), "alice");

    expect(screen.getByText("@alice")).toBeInTheDocument();
    expect(screen.queryByText("@bob")).not.toBeInTheDocument();
  });

  it("renders Select button to enter select mode", () => {
    mockReportsData = [createReportListItemFixture()];
    render(<ReportsPage />);

    expect(screen.getByText("Select")).toBeInTheDocument();
  });

  it("entering select mode shows Cancel button", async () => {
    mockReportsData = [createReportListItemFixture()];
    const user = userEvent.setup();
    render(<ReportsPage />);

    await user.click(screen.getByText("Select"));
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });
});
