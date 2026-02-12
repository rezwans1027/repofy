import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatsOverview } from "./stats-overview";
import { createReportFixture } from "@/__tests__/fixtures";

describe("StatsOverview", () => {
  const data = createReportFixture();

  it("renders Stats Overview header", () => {
    render(<StatsOverview stats={data.stats} />);
    expect(screen.getByText("Stats Overview")).toBeInTheDocument();
  });

  it("renders 4 stat labels", () => {
    render(<StatsOverview stats={data.stats} />);
    expect(screen.getByText("Repositories")).toBeInTheDocument();
    expect(screen.getByText("Total Stars")).toBeInTheDocument();
    expect(screen.getByText("Followers")).toBeInTheDocument();
    expect(screen.getByText("Contributions")).toBeInTheDocument();
  });

  it("renders starsPerRepo formatted value", () => {
    render(<StatsOverview stats={data.stats} />);
    expect(screen.getByText("Stars / Repo")).toBeInTheDocument();
  });

  it("renders collaborationRatio as percentage", () => {
    render(<StatsOverview stats={data.stats} />);
    expect(screen.getByText("Collaboration Ratio")).toBeInTheDocument();
  });

  it("renders interpretation text", () => {
    render(<StatsOverview stats={data.stats} />);
    expect(screen.getByText("High star count relative to repo count.")).toBeInTheDocument();
  });
});
