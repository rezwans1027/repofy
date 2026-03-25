import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ContributionHeatmap } from "./contribution-heatmap";

describe("ContributionHeatmap", () => {
  const heatmapData = [
    [0, 1, 2, 3, 4],
    [1, 0, 3, 2, 1],
  ];

  it("renders 'Contribution Activity' header", () => {
    render(<ContributionHeatmap heatmapData={heatmapData} />);
    expect(screen.getByText("Contribution Activity")).toBeInTheDocument();
  });

  it("renders 'Less' and 'More' legend labels when data is provided", () => {
    render(<ContributionHeatmap heatmapData={heatmapData} />);
    expect(screen.getByText("Less")).toBeInTheDocument();
    expect(screen.getByText("More")).toBeInTheDocument();
  });

  it("shows 'Contribution data unavailable' when heatmapData is null", () => {
    render(<ContributionHeatmap heatmapData={null} />);
    expect(
      screen.getByText(/Contribution data unavailable/)
    ).toBeInTheDocument();
  });

  it("does not render legend when heatmapData is null", () => {
    render(<ContributionHeatmap heatmapData={null} />);
    expect(screen.queryByText("Less")).not.toBeInTheDocument();
    expect(screen.queryByText("More")).not.toBeInTheDocument();
  });
});
