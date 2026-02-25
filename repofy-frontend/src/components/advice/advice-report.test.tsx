import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AdviceReport } from "./advice-report";
import { createAdviceFixture } from "@/__tests__/fixtures";

vi.mock("@/lib/export-pdf", () => ({
  exportToPdf: vi.fn().mockResolvedValue(undefined),
}));

describe("AdviceReport", () => {
  const data = createAdviceFixture();

  it("renders the username in the banner", () => {
    render(<AdviceReport username="testuser" data={data} />);
    const matches = screen.getAllByText("@testuser");
    expect(matches).toHaveLength(2); // banner + export bar
  });

  it("renders the summary text", () => {
    render(<AdviceReport username="testuser" data={data} />);
    expect(screen.getByText(data.summary)).toBeInTheDocument();
  });

  // ── Tab rendering ────────────────────────────────────────────────

  it("renders 3 tabs", () => {
    render(<AdviceReport username="testuser" data={data} />);
    expect(screen.getByText("Career Direction")).toBeInTheDocument();
    expect(screen.getByText("Build Plan")).toBeInTheDocument();
    expect(screen.getByText("Improve")).toBeInTheDocument();
  });

  it("shows Career Direction tab by default with trajectory", () => {
    render(<AdviceReport username="testuser" data={data} />);
    expect(screen.getByText("Career Trajectory")).toBeInTheDocument();
    expect(screen.getByText("Junior")).toBeInTheDocument();
  });

  it("switches to Build Plan tab showing builds and weekly roadmap", () => {
    render(<AdviceReport username="testuser" data={data} />);
    fireEvent.click(screen.getByText("Build Plan"));
    expect(screen.getByText("Build Roadmap")).toBeInTheDocument();
    expect(screen.getAllByText("Tested REST API").length).toBeGreaterThan(0);
    expect(screen.getByText("12-Week Roadmap")).toBeInTheDocument();
    expect(screen.getByText("Success Metrics")).toBeInTheDocument();
  });

  it("switches to Improve tab showing repo improvements, skill roadmap, and contribution strategy", () => {
    render(<AdviceReport username="testuser" data={data} />);
    fireEvent.click(screen.getByText("Improve"));
    expect(screen.getByText("Repository Improvements")).toBeInTheDocument();
    expect(screen.getByText("Skill Roadmap")).toBeInTheDocument();
    expect(screen.getByText("Contribution Strategy")).toBeInTheDocument();
    expect(screen.getByText("Profile Optimizations")).toBeInTheDocument();
  });

  // ── Build Plan tab ───────────────────────────────────────────────

  it("shows 3 builds with activeBuildTitle references in weekly roadmap", () => {
    render(<AdviceReport username="testuser" data={data} />);
    fireEvent.click(screen.getByText("Build Plan"));
    // Build titles appear in both BuildRoadmap cards and WeeklyRoadmap entries
    expect(screen.getAllByText("Tested REST API").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Published CLI Tool").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Real-Time Dashboard").length).toBeGreaterThan(0);
  });

  // ── Improve tab ──────────────────────────────────────────────────

  it("handles empty repo improvements with empty state", () => {
    const emptyData = createAdviceFixture({
      repoImprovements: [],
      generationWarnings: ["repo_improvements_unavailable"],
    });
    render(<AdviceReport username="testuser" data={emptyData} />);
    fireEvent.click(screen.getByText("Improve"));
    expect(screen.getByText("No repository improvement suggestions available for this profile.")).toBeInTheDocument();
  });

  it("handles empty skill roadmap with empty state", () => {
    const emptyData = createAdviceFixture({
      skillRoadmap: [],
      generationWarnings: ["skill_roadmap_reduced"],
    });
    render(<AdviceReport username="testuser" data={emptyData} />);
    fireEvent.click(screen.getByText("Improve"));
    expect(screen.getByText(/No skill suggestions available/)).toBeInTheDocument();
  });

  // ── Warning banner ───────────────────────────────────────────────

  it("renders warning banner when generationWarnings is non-empty", () => {
    const warnData = createAdviceFixture({
      generationWarnings: ["repo_improvements_unavailable"],
    });
    render(<AdviceReport username="testuser" data={warnData} />);
    expect(screen.getByText("Repo improvement suggestions could not be generated for this profile.")).toBeInTheDocument();
  });

  it("hides warning banner when generationWarnings is empty", () => {
    render(<AdviceReport username="testuser" data={data} />);
    expect(screen.queryByText("Repo improvement suggestions could not be generated for this profile.")).not.toBeInTheDocument();
  });

  it("shows correct copy per warning type", () => {
    const warnData = createAdviceFixture({
      generationWarnings: [
        "weekly_roadmap_synthesized",
        "success_metrics_reduced",
      ],
    });
    render(<AdviceReport username="testuser" data={warnData} />);
    expect(screen.getByText("The weekly roadmap was auto-generated from your build milestones.")).toBeInTheDocument();
    expect(screen.getByText("Some success metrics were refined for measurability.")).toBeInTheDocument();
  });

  // ── Export bar ───────────────────────────────────────────────────

  it("renders the export bar with username", () => {
    render(<AdviceReport username="testuser" data={data} />);
    const allTexts = screen.getAllByText("@testuser");
    expect(allTexts).toHaveLength(2); // banner + export bar
  });
});
