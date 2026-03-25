import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "vitest-axe";

import { StatsGrid } from "@/components/profile/sections/stats-grid";
import { TopLanguages } from "@/components/profile/sections/top-languages";
import { RecentActivity } from "@/components/profile/sections/recent-activity";
import { PrActivity } from "@/components/profile/sections/pr-activity";
import { TopCollaborators } from "@/components/profile/sections/top-collaborators";
import { CommitStreak } from "@/components/profile/sections/commit-streak";
import { ContributionHeatmap } from "@/components/profile/sections/contribution-heatmap";
import { AdviceEmptyState } from "@/components/advice/sections/advice-empty-state";
import { SuccessMetrics } from "@/components/advice/sections/success-metrics";
import { StrengthsAndGaps } from "@/components/advice/sections/strengths-and-gaps";

describe("Accessibility (axe)", () => {
  it("StatsGrid has no a11y violations", async () => {
    const { container } = render(
      <StatsGrid repos={10} stars={50} followers={20} contributions={100} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("TopLanguages has no a11y violations", async () => {
    const { container } = render(
      <TopLanguages
        languages={[
          { name: "TypeScript", color: "#3178C6", percentage: 60, repoCount: 5 },
          { name: "Rust", color: "#DEA584", percentage: 40 },
        ]}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("RecentActivity has no a11y violations", async () => {
    const { container } = render(
      <RecentActivity
        activityBreakdown={{ pushEvents: 50, prEvents: 25, issueEvents: 15, reviewEvents: 10 }}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("PrActivity has no a11y violations", async () => {
    const { container } = render(
      <PrActivity prActivity={{ opened: 30, merged: 25, reviewed: 15 }} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("TopCollaborators has no a11y violations", async () => {
    const { container } = render(
      <TopCollaborators
        collaborators={[
          { username: "alice", initials: "AL", contributions: 42 },
          { username: "bob", initials: "BO", contributions: 18 },
        ]}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("CommitStreak has no a11y violations", async () => {
    const { container } = render(
      <CommitStreak commitStreak={{ current: 12, longest: 45 }} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("ContributionHeatmap has no a11y violations (with data)", async () => {
    const { container } = render(
      <ContributionHeatmap heatmapData={[[0, 1, 2, 3], [1, 2, 3, 4]]} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("ContributionHeatmap has no a11y violations (null data)", async () => {
    const { container } = render(<ContributionHeatmap heatmapData={null} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("AdviceEmptyState has no a11y violations", async () => {
    const { container } = render(
      <AdviceEmptyState title="Test" message="No data available." />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("SuccessMetrics has no a11y violations", async () => {
    const { container } = render(
      <SuccessMetrics metrics={["Metric 1", "Metric 2"]} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("StrengthsAndGaps has no a11y violations", async () => {
    const { container } = render(
      <StrengthsAndGaps
        data={{
          strengths: [{ area: "Clean Code", detail: "Consistent naming." }],
          gaps: [{ area: "Testing", detail: "No tests found." }],
        }}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
