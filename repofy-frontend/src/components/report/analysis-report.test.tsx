import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnalysisReport } from "./analysis-report";
import { createReportFixture } from "@/__tests__/fixtures";

vi.mock("@/lib/export-pdf", () => ({
  exportToPdf: vi.fn().mockResolvedValue(undefined),
}));

describe("AnalysisReport", () => {
  it("renders all sections with real content", () => {
    const data = createReportFixture();
    render(<AnalysisReport username="testuser" data={data} />);

    // TopBanner
    expect(screen.getAllByText("@testuser")).toHaveLength(2);
    expect(screen.getByText("Senior")).toBeInTheDocument();
    expect(screen.getByText("Strong Hire")).toBeInTheDocument();

    // Summary (narrativeReport)
    expect(screen.getByText("Executive Summary")).toBeInTheDocument();

    // ExportBar
    expect(screen.getByText("Export PDF")).toBeInTheDocument();

    // Lazy-loaded sections (RadarSection, StatsOverview, etc.) are tested
    // in their own unit tests — Suspense won't resolve in sync renders.
  });

  it("passes username to TopBanner and ExportBar", () => {
    const data = createReportFixture();
    render(<AnalysisReport username="alexchendev" data={data} />);
    // Username appears in TopBanner as @alexchendev and in ExportBar
    const userTexts = screen.getAllByText("@alexchendev");
    expect(userTexts).toHaveLength(2);
  });

  it("uses static reportData when no data prop provided", () => {
    render(<AnalysisReport username="testuser" />);
    // Should render the static demo data narrative
    expect(screen.getByText("Executive Summary")).toBeInTheDocument();
  });

  it("uses custom data when provided", () => {
    const customData = createReportFixture({ narrativeReport: "Custom narrative text" });
    render(<AnalysisReport username="testuser" data={customData} />);
    expect(screen.getByText("Custom narrative text")).toBeInTheDocument();
  });

  it("renders the avatar when avatarUrl is provided", () => {
    const data = createReportFixture();
    render(<AnalysisReport username="testuser" avatarUrl="https://example.com/avatar.jpg" data={data} />);
    expect(screen.getByAltText("testuser")).toBeInTheDocument();
  });
});
