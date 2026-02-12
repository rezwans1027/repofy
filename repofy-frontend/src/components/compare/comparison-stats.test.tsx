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
});
