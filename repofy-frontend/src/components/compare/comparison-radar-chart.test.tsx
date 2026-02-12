import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ComparisonRadarChart } from "./comparison-radar-chart";
import { createReportFixture } from "@/__tests__/fixtures";

describe("ComparisonRadarChart", () => {
  const dataA = createReportFixture();
  const dataB = createReportFixture();

  it("renders Developer DNA Comparison header", () => {
    render(
      <ComparisonRadarChart
        dataA={dataA.radarAxes}
        dataB={dataB.radarAxes}
        usernameA="alice"
        usernameB="bob"
        breakdownA={dataA.radarBreakdown}
        breakdownB={dataB.radarBreakdown}
      />
    );
    expect(screen.getByText("Developer DNA Comparison")).toBeInTheDocument();
  });

  it("renders SVG element", () => {
    const { container } = render(
      <ComparisonRadarChart
        dataA={dataA.radarAxes}
        dataB={dataB.radarAxes}
        usernameA="alice"
        usernameB="bob"
        breakdownA={dataA.radarBreakdown}
        breakdownB={dataB.radarBreakdown}
      />
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders legend with both usernames", () => {
    render(
      <ComparisonRadarChart
        dataA={dataA.radarAxes}
        dataB={dataB.radarAxes}
        usernameA="alice"
        usernameB="bob"
        breakdownA={dataA.radarBreakdown}
        breakdownB={dataB.radarBreakdown}
      />
    );
    expect(screen.getByText("@alice")).toBeInTheDocument();
    expect(screen.getByText("@bob")).toBeInTheDocument();
  });

  it("renders breakdown table with axis labels", () => {
    render(
      <ComparisonRadarChart
        dataA={dataA.radarAxes}
        dataB={dataB.radarAxes}
        usernameA="alice"
        usernameB="bob"
        breakdownA={dataA.radarBreakdown}
        breakdownB={dataB.radarBreakdown}
      />
    );
    // Breakdown labels appear in the table section (not SVG text elements)
    const allCodeQuality = screen.getAllByText("Code Quality");
    expect(allCodeQuality).toHaveLength(2);
    const allConsistency = screen.getAllByText("Consistency");
    expect(allConsistency).toHaveLength(2);
  });
});
