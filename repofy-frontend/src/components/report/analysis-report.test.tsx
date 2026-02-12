import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnalysisReport } from "./analysis-report";
import { createReportFixture } from "@/__tests__/fixtures";
import { reportData as staticReportData } from "@/lib/demo-data";

vi.mock("@/lib/export-pdf", () => ({
  exportToPdf: vi.fn().mockResolvedValue(undefined),
}));

describe("AnalysisReport", () => {
  it("renders all sections with real content", () => {
    const data = createReportFixture();
    render(<AnalysisReport username="testuser" data={data} />);

    // TopBanner
    expect(screen.getAllByText("@testuser").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Senior")).toBeInTheDocument();
    expect(screen.getByText("Strong Hire")).toBeInTheDocument();

    // Summary
    expect(screen.getByText("Executive Summary")).toBeInTheDocument();
    expect(screen.getByText("A strong engineer with excellent code quality.")).toBeInTheDocument();

    // RadarSection
    expect(screen.getByText("Developer DNA")).toBeInTheDocument();

    // StatsOverview
    expect(screen.getByText("Stats Overview")).toBeInTheDocument();
    expect(screen.getByText("Repositories")).toBeInTheDocument();

    // ActivityBreakdown
    expect(screen.getByText("Activity Breakdown")).toBeInTheDocument();

    // LanguageProfile
    expect(screen.getByText("Language Profile")).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();

    // TopRepos
    expect(screen.getByText("Top Repositories")).toBeInTheDocument();
    expect(screen.getByText("test-repo")).toBeInTheDocument();

    // Strengths
    expect(screen.getByText("Strengths")).toBeInTheDocument();
    expect(screen.getByText("Consistent commits")).toBeInTheDocument();

    // Weaknesses
    expect(screen.getByText("Areas for Improvement")).toBeInTheDocument();
    expect(screen.getByText("Testing varies")).toBeInTheDocument();

    // RedFlags
    expect(screen.getByText("Red Flags")).toBeInTheDocument();
    expect(screen.getByText("Outdated dependencies")).toBeInTheDocument();

    // InterviewQuestions
    expect(screen.getByText("Suggested Interview Questions")).toBeInTheDocument();
    expect(screen.getByText("Describe your testing approach.")).toBeInTheDocument();

    // ExportBar
    expect(screen.getByText("Export PDF")).toBeInTheDocument();
  });

  it("passes username to TopBanner and ExportBar", () => {
    const data = createReportFixture();
    render(<AnalysisReport username="alexchendev" data={data} />);
    // Username appears in TopBanner as @alexchendev and in ExportBar
    const userTexts = screen.getAllByText("@alexchendev");
    expect(userTexts.length).toBeGreaterThanOrEqual(2);
  });

  it("uses static reportData when no data prop provided", () => {
    render(<AnalysisReport username="testuser" />);
    // Should render the static demo data summary
    expect(screen.getByText(staticReportData.summary)).toBeInTheDocument();
  });

  it("uses custom data when provided", () => {
    const customData = createReportFixture({ summary: "Custom summary text" });
    render(<AnalysisReport username="testuser" data={customData} />);
    expect(screen.getByText("Custom summary text")).toBeInTheDocument();
  });

  it("renders the avatar when avatarUrl is provided", () => {
    const data = createReportFixture();
    render(<AnalysisReport username="testuser" avatarUrl="https://example.com/avatar.jpg" data={data} />);
    expect(screen.getByAltText("testuser")).toBeInTheDocument();
  });
});
