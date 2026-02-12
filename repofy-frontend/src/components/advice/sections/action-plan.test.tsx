import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActionPlan } from "./action-plan";
import { createAdviceFixture } from "@/__tests__/fixtures";

describe("ActionPlan", () => {
  const data = createAdviceFixture();

  it("renders Action Plan header", () => {
    render(<ActionPlan actionPlan={data.actionPlan} />);
    expect(screen.getByText("Action Plan")).toBeInTheDocument();
  });

  it("renders 3 timeframe headers", () => {
    render(<ActionPlan actionPlan={data.actionPlan} />);
    expect(screen.getByText("30 days")).toBeInTheDocument();
    expect(screen.getByText("60 days")).toBeInTheDocument();
    expect(screen.getByText("90 days")).toBeInTheDocument();
  });

  it("renders action items for each timeframe", () => {
    render(<ActionPlan actionPlan={data.actionPlan} />);
    expect(screen.getByText("Add tests to top 3 repos")).toBeInTheDocument();
    expect(screen.getByText("Update GitHub bio")).toBeInTheDocument();
    expect(screen.getByText("Launch side project")).toBeInTheDocument();
    expect(screen.getByText("Start blogging")).toBeInTheDocument();
    expect(screen.getByText("Contribute to 2 OSS projects")).toBeInTheDocument();
    expect(screen.getByText("Apply to speak at meetup")).toBeInTheDocument();
  });
});
