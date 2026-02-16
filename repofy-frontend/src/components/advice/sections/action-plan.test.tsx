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

  it("renders phase heading with empty actions array", () => {
    const emptyPlan = [
      { timeframe: "30 days" as const, actions: [] },
    ];
    render(<ActionPlan actionPlan={emptyPlan} />);
    expect(screen.getByText("30 days")).toBeInTheDocument();
    // No action items should be rendered
    expect(screen.queryByText("Add tests to top 3 repos")).not.toBeInTheDocument();
  });

  it("renders only provided timeframes and omits missing ones", () => {
    const partialPlan = [
      { timeframe: "30 days" as const, actions: ["Do X"] },
      { timeframe: "90 days" as const, actions: ["Do Y"] },
    ];
    render(<ActionPlan actionPlan={partialPlan} />);
    expect(screen.getByText("30 days")).toBeInTheDocument();
    expect(screen.getByText("90 days")).toBeInTheDocument();
    expect(screen.queryByText("60 days")).not.toBeInTheDocument();
    expect(screen.getByText("Do X")).toBeInTheDocument();
    expect(screen.getByText("Do Y")).toBeInTheDocument();
  });
});
