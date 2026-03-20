import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatsGrid } from "./stats-grid";

describe("StatsGrid", () => {
  const defaultProps = {
    repos: 42,
    stars: 150,
    followers: 30,
    contributions: 500,
  };

  it("renders all 4 stat labels", () => {
    render(<StatsGrid {...defaultProps} />);
    expect(screen.getByText("Repositories")).toBeInTheDocument();
    expect(screen.getByText("Stars Earned")).toBeInTheDocument();
    expect(screen.getByText("Followers")).toBeInTheDocument();
    expect(screen.getByText("Contributions")).toBeInTheDocument();
  });

  it("shows 'Recent Events' instead of 'Contributions' when contributionsIsEstimate is true", () => {
    render(<StatsGrid {...defaultProps} contributionsIsEstimate={true} />);
    expect(screen.getByText("Recent Events")).toBeInTheDocument();
    expect(screen.queryByText("Contributions")).not.toBeInTheDocument();
  });

  it("shows 'Contributions' when contributionsIsEstimate is false", () => {
    render(<StatsGrid {...defaultProps} contributionsIsEstimate={false} />);
    expect(screen.getByText("Contributions")).toBeInTheDocument();
    expect(screen.queryByText("Recent Events")).not.toBeInTheDocument();
  });
});
