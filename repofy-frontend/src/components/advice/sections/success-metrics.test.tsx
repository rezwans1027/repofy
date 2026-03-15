import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SuccessMetrics } from "./success-metrics";

describe("SuccessMetrics", () => {
  const metrics = [
    "Reach 3+ merged PRs to OSS repos outside personal projects within 12 weeks.",
    "Deploy all 3 portfolio builds with public URLs by week 12.",
    "Achieve 80%+ test coverage on the REST API build by week 4.",
  ];

  it("renders Success Metrics header", () => {
    render(<SuccessMetrics metrics={metrics} />);
    expect(screen.getByText("Success Metrics")).toBeInTheDocument();
  });

  it("renders each metric text", () => {
    render(<SuccessMetrics metrics={metrics} />);
    expect(screen.getByText("Reach 3+ merged PRs to OSS repos outside personal projects within 12 weeks.")).toBeInTheDocument();
    expect(screen.getByText("Deploy all 3 portfolio builds with public URLs by week 12.")).toBeInTheDocument();
    expect(screen.getByText("Achieve 80%+ test coverage on the REST API build by week 4.")).toBeInTheDocument();
  });

  it("shows empty message when array is empty", () => {
    render(<SuccessMetrics metrics={[]} />);
    expect(screen.getByText("No success metrics available.")).toBeInTheDocument();
  });
});
