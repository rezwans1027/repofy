import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActivityBreakdown } from "./activity-breakdown";
import { createReportFixture } from "@/__tests__/fixtures";

describe("ActivityBreakdown", () => {
  const data = createReportFixture();

  it("renders Activity Breakdown header", () => {
    render(<ActivityBreakdown activityBreakdown={data.activityBreakdown} />);
    expect(screen.getByText("Activity Breakdown")).toBeInTheDocument();
  });

  it("renders 4 segment labels with percentages", () => {
    render(<ActivityBreakdown activityBreakdown={data.activityBreakdown} />);
    expect(screen.getByText(/Push/)).toBeInTheDocument();
    expect(screen.getByText(/PR/)).toBeInTheDocument();
    expect(screen.getByText(/Issue/)).toBeInTheDocument();
    expect(screen.getByText(/Review/)).toBeInTheDocument();
  });

  it("renders interpretation text", () => {
    render(<ActivityBreakdown activityBreakdown={data.activityBreakdown} />);
    expect(screen.getByText("Primarily a builder.")).toBeInTheDocument();
  });
});
