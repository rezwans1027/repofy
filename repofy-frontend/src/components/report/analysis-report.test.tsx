import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock all subsection components to simplify testing
let capturedTopBannerProps: any = {};
let capturedSummaryProps: any = {};

vi.mock("./sections/top-banner", () => ({
  TopBanner: (props: any) => {
    capturedTopBannerProps = props;
    return <div data-testid="top-banner">{props.username}</div>;
  },
}));
vi.mock("./sections/summary", () => ({
  Summary: (props: any) => {
    capturedSummaryProps = props;
    return <div data-testid="summary">{props.summary}</div>;
  },
}));
vi.mock("./sections/radar-section", () => ({
  RadarSection: () => <div data-testid="radar-section">Radar</div>,
}));
vi.mock("./sections/stats-overview", () => ({
  StatsOverview: () => <div data-testid="stats-overview">Stats</div>,
}));
vi.mock("./sections/activity-breakdown", () => ({
  ActivityBreakdown: () => <div data-testid="activity-breakdown">Activity</div>,
}));
vi.mock("./sections/language-profile", () => ({
  LanguageProfile: () => <div data-testid="language-profile">Languages</div>,
}));
vi.mock("./sections/top-repos", () => ({
  TopRepos: () => <div data-testid="top-repos">Repos</div>,
}));
vi.mock("./sections/strengths", () => ({
  Strengths: () => <div data-testid="strengths">Strengths</div>,
}));
vi.mock("./sections/weaknesses", () => ({
  Weaknesses: () => <div data-testid="weaknesses">Weaknesses</div>,
}));
vi.mock("./sections/red-flags", () => ({
  RedFlags: () => <div data-testid="red-flags">Red Flags</div>,
}));
vi.mock("./sections/interview-questions", () => ({
  InterviewQuestions: () => <div data-testid="interview-questions">Questions</div>,
}));
vi.mock("./sections/export-bar", () => ({
  ExportBar: () => <div data-testid="export-bar">Export</div>,
}));

import { AnalysisReport } from "./analysis-report";
import { reportData } from "@/lib/demo-data";

describe("AnalysisReport", () => {
  it("renders all sections", () => {
    render(<AnalysisReport username="testuser" />);

    expect(screen.getByTestId("top-banner")).toBeInTheDocument();
    expect(screen.getByTestId("summary")).toBeInTheDocument();
    expect(screen.getByTestId("radar-section")).toBeInTheDocument();
    expect(screen.getByTestId("stats-overview")).toBeInTheDocument();
    expect(screen.getByTestId("activity-breakdown")).toBeInTheDocument();
    expect(screen.getByTestId("language-profile")).toBeInTheDocument();
    expect(screen.getByTestId("top-repos")).toBeInTheDocument();
    expect(screen.getByTestId("strengths")).toBeInTheDocument();
    expect(screen.getByTestId("weaknesses")).toBeInTheDocument();
    expect(screen.getByTestId("red-flags")).toBeInTheDocument();
    expect(screen.getByTestId("interview-questions")).toBeInTheDocument();
    expect(screen.getByTestId("export-bar")).toBeInTheDocument();
  });

  it("passes username to TopBanner", () => {
    render(<AnalysisReport username="alexchendev" />);
    expect(capturedTopBannerProps.username).toBe("alexchendev");
  });

  it("uses static reportData when no data prop provided", () => {
    render(<AnalysisReport username="testuser" />);
    expect(capturedSummaryProps.summary).toBe(reportData.summary);
  });

  it("uses custom data when provided", () => {
    const customData = { ...reportData, summary: "Custom summary text" };
    render(<AnalysisReport username="testuser" data={customData} />);
    expect(capturedSummaryProps.summary).toBe("Custom summary text");
  });
});
