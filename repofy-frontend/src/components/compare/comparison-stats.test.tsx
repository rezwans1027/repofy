import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ComparisonStats } from "./comparison-stats";
import { createReportFixture } from "@/__tests__/fixtures";

describe("ComparisonStats", () => {
  const reportA = createReportFixture();
  const reportB = createReportFixture({ stats: { repos: 30, stars: 1200, followers: 500, contributions: 900, starsPerRepo: 40.0, collaborationRatio: 0.45, interpretation: "Moderate activity." } });

  it("renders Stats Comparison header", () => {
    render(<ComparisonStats reportA={reportA} reportB={reportB} usernameA="alice" usernameB="bob" />);
    expect(screen.getByText("Stats Comparison")).toBeInTheDocument();
  });

  it("renders 4 metric labels", () => {
    render(<ComparisonStats reportA={reportA} reportB={reportB} usernameA="alice" usernameB="bob" />);
    expect(screen.getByText("Repositories")).toBeInTheDocument();
    expect(screen.getByText("Total Stars")).toBeInTheDocument();
    expect(screen.getByText("Followers")).toBeInTheDocument();
    expect(screen.getByText("Contributions")).toBeInTheDocument();
  });

  it("renders Stars / Repo label", () => {
    render(<ComparisonStats reportA={reportA} reportB={reportB} usernameA="alice" usernameB="bob" />);
    expect(screen.getByText("Stars / Repo")).toBeInTheDocument();
  });

  it("renders Collaboration Ratio label", () => {
    render(<ComparisonStats reportA={reportA} reportB={reportB} usernameA="alice" usernameB="bob" />);
    expect(screen.getByText("Collaboration Ratio")).toBeInTheDocument();
  });

  it("renders ArrowUp SVG for metric winner", () => {
    // reportA has repos=47, reportB has repos=30, so A wins on Repositories
    const { container } = render(
      <ComparisonStats reportA={reportA} reportB={reportB} usernameA="alice" usernameB="bob" />
    );
    // The metric cards are rendered as grid children. ArrowUp renders as an SVG.
    // With reportA.repos(47) > reportB.repos(30), the A side gets an ArrowUp icon.
    const svgs = container.querySelectorAll("svg");
    // At least one SVG (ArrowUp) should exist for winning metrics
    expect(svgs.length).toBeGreaterThan(0);
  });

  it("renders no ArrowUp for equal metric values", () => {
    const equalA = createReportFixture({ stats: { ...createReportFixture().stats, repos: 30 } });
    const equalB = createReportFixture({ stats: { ...createReportFixture().stats, repos: 30 } });
    const { container } = render(
      <ComparisonStats reportA={equalA} reportB={equalB} usernameA="alice" usernameB="bob" />
    );
    // Find the Repositories card and check it has no SVG children (no ArrowUp)
    const metricCards = container.querySelectorAll(".grid > div");
    const reposCard = Array.from(metricCards).find((el) => el.textContent?.includes("Repositories"))!;
    const arrowSvgs = reposCard.querySelectorAll("svg");
    expect(arrowSvgs).toHaveLength(0);
  });

  it("renders starsPerRepo formatted to 1 decimal", () => {
    render(<ComparisonStats reportA={reportA} reportB={reportB} usernameA="alice" usernameB="bob" />);
    expect(screen.getByText("49.8")).toBeInTheDocument();
    expect(screen.getByText("40.0")).toBeInTheDocument();
  });

  it("renders collaborationRatio as percentage", () => {
    render(<ComparisonStats reportA={reportA} reportB={reportB} usernameA="alice" usernameB="bob" />);
    expect(screen.getByText("34%")).toBeInTheDocument();
    expect(screen.getByText("45%")).toBeInTheDocument();
  });
});
