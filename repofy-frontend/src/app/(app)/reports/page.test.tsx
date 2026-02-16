import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createReportListItemFixture,
  createReportListItemSet,
} from "@/__tests__/fixtures";
import { authMockFactory } from "@/__tests__/helpers/mock-auth";

vi.mock("@/components/providers/auth-provider", () => authMockFactory());

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

import { navState, navModule, resetNavState } from "@/__tests__/helpers/mock-navigation";

navState.pathname = "/reports";
vi.mock("next/navigation", () => navModule);

import ReportsPage from "./page";

describe("ReportsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetNavState();
    navState.pathname = "/reports";
    mockReportsData = [];
  });

  it("shows empty state when no reports exist", () => {
    render(<ReportsPage />);
    expect(screen.getByText("No reports yet")).toBeInTheDocument();
    expect(screen.getByText("Go to search")).toBeInTheDocument();
  });

  it("renders report table when reports exist", () => {
    mockReportsData = createReportListItemSet();

    render(<ReportsPage />);

    expect(screen.getByText("Reports")).toBeInTheDocument();
    expect(screen.getByText("@alice")).toBeInTheDocument();
    expect(screen.getByText("@bob")).toBeInTheDocument();
    expect(screen.getByText("@charlie")).toBeInTheDocument();
    expect(screen.getByText("@diana")).toBeInTheDocument();
    expect(screen.getByText("@eve")).toBeInTheDocument();
    expect(screen.getByText("92")).toBeInTheDocument();
    expect(screen.getByText("71")).toBeInTheDocument();
    expect(screen.getByText("55")).toBeInTheDocument();
    expect(screen.getByText("38")).toBeInTheDocument();
    expect(screen.getByText("80")).toBeInTheDocument();
  });

  it("renders search input for filtering", () => {
    mockReportsData = [createReportListItemFixture()];

    render(<ReportsPage />);
    const searchInput = screen.getByPlaceholderText("Search\u2026");
    expect(searchInput).toBeInTheDocument();
  });

  it("filters reports by search query", async () => {
    mockReportsData = [
      createReportListItemFixture({ id: "r1", analyzed_username: "alice" }),
      createReportListItemFixture({ id: "r2", analyzed_username: "bob" }),
    ];

    const user = userEvent.setup();
    render(<ReportsPage />);

    await user.type(screen.getByPlaceholderText("Search\u2026"), "alice");

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

  // --- New tests ---

  it("filters by recommendation", async () => {
    mockReportsData = createReportListItemSet();
    const user = userEvent.setup();
    render(<ReportsPage />);

    // Open the Filter popover
    await user.click(screen.getByTestId("reports-filter"));

    // Click the "Strong Hire" badge button
    const strongHireButtons = screen.getAllByRole("button", { name: /Strong Hire/i });
    // The badge button inside the popover (not the filter trigger)
    const strongHireBadgeBtn = strongHireButtons.find(
      (btn) => btn.tagName.toLowerCase() === "button" && btn.textContent === "Strong Hire"
    )!;
    await user.click(strongHireBadgeBtn);

    // alice (92) and eve (80) are Strong Hire
    expect(screen.getByText("@alice")).toBeInTheDocument();
    expect(screen.getByText("@eve")).toBeInTheDocument();

    // bob, charlie, diana should not be visible
    expect(screen.queryByText("@bob")).not.toBeInTheDocument();
    expect(screen.queryByText("@charlie")).not.toBeInTheDocument();
    expect(screen.queryByText("@diana")).not.toBeInTheDocument();
  });

  it("filters by score range", async () => {
    mockReportsData = createReportListItemSet();
    const user = userEvent.setup();
    render(<ReportsPage />);

    // Open the Filter popover
    await user.click(screen.getByTestId("reports-filter"));

    // Find the min score input (type=number, current value 0)
    const numberInputs = screen.getAllByRole("spinbutton");
    const minInput = numberInputs[0];

    // Set value directly to avoid controlled-input typing issues
    fireEvent.change(minInput, { target: { value: "70" } });

    // alice (92), bob (71), eve (80) are >= 70
    expect(screen.getByText("@alice")).toBeInTheDocument();
    expect(screen.getByText("@bob")).toBeInTheDocument();
    expect(screen.getByText("@eve")).toBeInTheDocument();

    // charlie (55), diana (38) are < 70
    expect(screen.queryByText("@charlie")).not.toBeInTheDocument();
    expect(screen.queryByText("@diana")).not.toBeInTheDocument();
  });

  it("sorts by score descending", async () => {
    mockReportsData = createReportListItemSet();
    const user = userEvent.setup();
    render(<ReportsPage />);

    // Click the sort dropdown trigger (shows "Newest first" by default)
    await user.click(screen.getByRole("button", { name: /Newest first/i }));

    // Click "Highest score" menu item
    await user.click(screen.getByRole("menuitem", { name: /Highest score/i }));

    // The first @username in document order should be alice (92)
    const usernames = screen.getAllByText(/@\w+/);
    expect(usernames[0]).toHaveTextContent("@alice");
  });

  it("sorts by score ascending", async () => {
    mockReportsData = createReportListItemSet();
    const user = userEvent.setup();
    render(<ReportsPage />);

    // Click the sort dropdown trigger
    await user.click(screen.getByRole("button", { name: /Newest first/i }));

    // Click "Lowest score" menu item
    await user.click(screen.getByRole("menuitem", { name: /Lowest score/i }));

    // The first @username in document order should be diana (38)
    const usernames = screen.getAllByText(/@\w+/);
    expect(usernames[0]).toHaveTextContent("@diana");
  });

  it("sorts by date ascending", async () => {
    mockReportsData = createReportListItemSet();
    const user = userEvent.setup();
    render(<ReportsPage />);

    // Click the sort dropdown trigger
    await user.click(screen.getByRole("button", { name: /Newest first/i }));

    // Click "Oldest first" menu item
    await user.click(screen.getByRole("menuitem", { name: /Oldest first/i }));

    // diana has the earliest date (Jan 12), so should be first
    const usernames = screen.getAllByText(/@\w+/);
    expect(usernames[0]).toHaveTextContent("@diana");
  });

  it("shows empty filter state", async () => {
    mockReportsData = createReportListItemSet();
    const user = userEvent.setup();
    render(<ReportsPage />);

    // Type a query that matches nothing
    await user.type(screen.getByPlaceholderText("Search\u2026"), "zzz");

    expect(
      screen.getByText("No reports match your filters")
    ).toBeInTheDocument();
    expect(screen.getByText("Clear all filters")).toBeInTheDocument();
  });

  it("clear all filters resets", async () => {
    mockReportsData = createReportListItemSet();
    const user = userEvent.setup();
    render(<ReportsPage />);

    // Type a query that matches nothing
    await user.type(screen.getByPlaceholderText("Search\u2026"), "zzz");

    expect(
      screen.getByText("No reports match your filters")
    ).toBeInTheDocument();

    // Click "Clear all filters"
    await user.click(screen.getByText("Clear all filters"));

    // All 5 usernames should be visible again
    expect(screen.getByText("@alice")).toBeInTheDocument();
    expect(screen.getByText("@bob")).toBeInTheDocument();
    expect(screen.getByText("@charlie")).toBeInTheDocument();
    expect(screen.getByText("@diana")).toBeInTheDocument();
    expect(screen.getByText("@eve")).toBeInTheDocument();
  });

  it("searches by analyzed_name", () => {
    mockReportsData = createReportListItemSet();
    render(<ReportsPage />);

    // Set search value directly to avoid controlled-input typing issues
    fireEvent.change(screen.getByPlaceholderText("Search\u2026"), {
      target: { value: "Alice Dev" },
    });

    // Only alice should be visible (matches analyzed_name)
    expect(screen.getByText("@alice")).toBeInTheDocument();
    expect(screen.queryByText("@bob")).not.toBeInTheDocument();
    expect(screen.queryByText("@charlie")).not.toBeInTheDocument();
    expect(screen.queryByText("@diana")).not.toBeInTheDocument();
    expect(screen.queryByText("@eve")).not.toBeInTheDocument();
  });

  it("delete flow calls mutateAsync with selected IDs", async () => {
    mockReportsData = createReportListItemSet();
    const user = userEvent.setup();
    render(<ReportsPage />);

    // Enter select mode
    await user.click(screen.getByText("Select"));

    // Click the first two report rows by test ID to select them
    // Default sort is "Newest first" (date desc): alice (r1, Jan 16), bob (r2, Jan 15), charlie (r3), eve (r4), diana (r5)
    await user.click(screen.getByTestId("report-row-r1"));
    await user.click(screen.getByTestId("report-row-r2"));

    // Selection bar should show "2 selected"
    expect(screen.getByText("2 selected")).toBeInTheDocument();

    // Click Delete
    await user.click(screen.getByText("Delete"));

    expect(mockDeleteMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockDeleteMutateAsync).toHaveBeenCalledWith(["r1", "r2"]);
  });
});
