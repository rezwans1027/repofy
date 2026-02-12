import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RadarSection } from "./radar-section";
import { createReportFixture } from "@/__tests__/fixtures";

describe("RadarSection", () => {
  const data = createReportFixture();

  it("renders Developer DNA header", () => {
    render(<RadarSection radarAxes={data.radarAxes} radarBreakdown={data.radarBreakdown} />);
    expect(screen.getByText("Developer DNA")).toBeInTheDocument();
  });

  it("renders breakdown labels and scores", () => {
    render(<RadarSection radarAxes={data.radarAxes} radarBreakdown={data.radarBreakdown} />);
    // Labels appear in both radar chart SVG and breakdown list
    expect(screen.getAllByText("Code Quality").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Project Complexity").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Technical Breadth").length).toBeGreaterThanOrEqual(1);
  });

  it("renders breakdown notes", () => {
    render(<RadarSection radarAxes={data.radarAxes} radarBreakdown={data.radarBreakdown} />);
    expect(screen.getByText("Clean code")).toBeInTheDocument();
    expect(screen.getByText("Regular commits")).toBeInTheDocument();
  });
});
