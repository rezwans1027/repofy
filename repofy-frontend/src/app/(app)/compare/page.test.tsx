import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { createReportListItemFixture } from "@/__tests__/fixtures";
import { authMockFactory } from "@/__tests__/helpers/mock-auth";

vi.mock("@/components/providers/auth-provider", () => authMockFactory());

// Mock reports data
let mockReports: any[] = [];
let mockReportDataA: any = null;
let mockReportDataB: any = null;

vi.mock("@/hooks/use-reports", () => ({
  useReports: () => ({
    data: mockReports,
    isPending: false,
    error: null,
  }),
  useReport: (id: string) => ({
    data: id === "r1" ? mockReportDataA : id === "r2" ? mockReportDataB : null,
  }),
}));

// Mock all comparison components
vi.mock("@/components/compare/candidate-picker", () => ({
  CandidatePicker: (props: any) => (
    <div data-testid={`candidate-picker-${props.slot.toLowerCase()}`}>
      Candidate {props.slot}
    </div>
  ),
}));
vi.mock("@/components/compare/comparison-verdict", () => ({
  ComparisonVerdict: () => <div data-testid="comparison-verdict">Verdict</div>,
}));
vi.mock("@/components/compare/comparison-radar-chart", () => ({
  ComparisonRadarChart: () => <div data-testid="comparison-radar">Radar</div>,
}));
vi.mock("@/components/compare/comparison-stats", () => ({
  ComparisonStats: () => <div>Stats</div>,
}));
vi.mock("@/components/compare/comparison-activity", () => ({
  ComparisonActivity: () => <div>Activity</div>,
}));
vi.mock("@/components/compare/comparison-languages", () => ({
  ComparisonLanguages: () => <div>Languages</div>,
}));
vi.mock("@/components/compare/comparison-side-by-side", () => ({
  ComparisonSideBySide: () => <div>Side By Side</div>,
  StrengthsList: () => <div>Strengths</div>,
  WeaknessesList: () => <div>Weaknesses</div>,
  RedFlagsList: () => <div>RedFlags</div>,
  InterviewQuestionsList: () => <div>Questions</div>,
  TopReposList: () => <div>Repos</div>,
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
    expect(screen.getByTestId("candidate-picker-a")).toBeInTheDocument();
    expect(screen.getByTestId("candidate-picker-b")).toBeInTheDocument();
  });

  it("shows Go to search link in empty state with 0 reports", () => {
    mockReports = [];
    render(<ComparePage />);
    // When reports is empty array, length < 2 triggers "Need at least 2 reports"
    expect(screen.getByText("Need at least 2 reports to compare")).toBeInTheDocument();
    expect(screen.getByText("Go to search")).toBeInTheDocument();
  });

  it("shows Go to search link in empty state with 1 report", () => {
    mockReports = [createReportListItemFixture()];
    render(<ComparePage />);
    expect(screen.getByText("Go to search")).toBeInTheDocument();
  });
});
