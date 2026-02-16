import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createReportListItemFixture, createReportFixture } from "@/__tests__/fixtures";
import { authMockFactory } from "@/__tests__/helpers/mock-auth";

vi.mock("@/components/providers/auth-provider", () => authMockFactory());

// Mock export-pdf so un-mocked children that import it don't fail
vi.mock("@/lib/export-pdf", () => ({
  exportToPdf: vi.fn().mockResolvedValue(undefined),
}));

// Mock reports data
let mockReports: any[] = [];
let mockReportDataA: any = null;
let mockReportDataB: any = null;
let mockReportsError: Error | null = null;

vi.mock("@/hooks/use-reports", () => ({
  useReports: () => ({
    data: mockReports,
    isPending: false,
    error: mockReportsError,
  }),
  useReport: (id: string) => ({
    data: id === "r1" ? mockReportDataA : id === "r2" ? mockReportDataB : null,
  }),
}));

// Keep mocks for components with heavy external deps or complex SVG
vi.mock("@/components/compare/comparison-radar-chart", () => ({
  ComparisonRadarChart: () => <div data-testid="comparison-radar">Radar</div>,
}));
vi.mock("@/components/compare/comparison-export-bar", () => ({
  ComparisonExportBar: () => <div>Export</div>,
}));

import ComparePage from "./page";

describe("ComparePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReports = [];
    mockReportDataA = null;
    mockReportDataB = null;
    mockReportsError = null;
    // cmdk calls scrollIntoView which jsdom doesn't implement
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("shows empty state when fewer than 2 reports", () => {
    mockReports = [createReportListItemFixture()];
    render(<ComparePage />);
    expect(screen.getByText("Need at least 2 reports to compare")).toBeInTheDocument();
  });

  it("renders candidate pickers when 2+ reports exist", () => {
    mockReports = [
      createReportListItemFixture({ id: "r1", analyzed_username: "alice" }),
      createReportListItemFixture({ id: "r2", analyzed_username: "bob" }),
    ];

    render(<ComparePage />);

    expect(screen.getByText("Compare Candidates")).toBeInTheDocument();
    const comboboxes = screen.getAllByRole("combobox");
    expect(comboboxes).toHaveLength(2);
  });

  it("shows Go to search link in empty state with 0 reports", () => {
    mockReports = [];
    render(<ComparePage />);
    expect(screen.getByText("Need at least 2 reports to compare")).toBeInTheDocument();
    expect(screen.getByText("Go to search")).toBeInTheDocument();
  });

  it("shows Go to search link in empty state with 1 report", () => {
    mockReports = [createReportListItemFixture()];
    render(<ComparePage />);
    expect(screen.getByText("Go to search")).toBeInTheDocument();
  });

  it("error state renders retry button", () => {
    mockReportsError = new Error("Load failed");
    render(<ComparePage />);

    expect(screen.getByText("Load failed")).toBeInTheDocument();
    expect(screen.getByText("retry")).toBeInTheDocument();
  });

  it("renders comparison sections when both candidates are selected", async () => {
    const reportA = createReportFixture({ overallScore: 92, recommendation: "Strong Hire" });
    const reportB = createReportFixture({ overallScore: 71, recommendation: "Hire" });
    mockReportDataA = { report_data: reportA, analyzed_username: "alice" };
    mockReportDataB = { report_data: reportB, analyzed_username: "bob" };
    mockReports = [
      createReportListItemFixture({ id: "r1", analyzed_username: "alice" }),
      createReportListItemFixture({ id: "r2", analyzed_username: "bob" }),
    ];

    const user = userEvent.setup();
    render(<ComparePage />);

    // Select Candidate A
    await user.click(screen.getAllByRole("combobox")[0]);
    const optionA = await screen.findByRole("option", { name: /alice/i });
    await user.click(optionA);

    // After selecting alice, the component re-renders. Get a fresh reference for combobox B
    // and click it to open. Radix Popover in jsdom may keep aria-expanded stale,
    // so use the data-testid container to find the second trigger.
    const pickerB = screen.getByTestId("candidate-picker-b");
    const comboboxB = pickerB.querySelector('[role="combobox"]')!;
    await user.click(comboboxB);

    const optionB = await screen.findByRole("option", { name: /bob/i });
    await user.click(optionB);

    // Comparison sections should render
    await waitFor(() => {
      expect(screen.getByText(/strengths/i)).toBeInTheDocument();
    });
  });
});
