import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WeeklyRoadmap } from "./weekly-roadmap";
import { createAdviceFixture } from "@/__tests__/fixtures";

describe("WeeklyRoadmap", () => {
  const data = createAdviceFixture();

  it("renders 12-Week Roadmap header", () => {
    render(<WeeklyRoadmap weeks={data.weeklyRoadmap} builds={data.buildRoadmap} />);
    expect(screen.getByText("12-Week Roadmap")).toBeInTheDocument();
  });

  it("renders week numbers", () => {
    render(<WeeklyRoadmap weeks={data.weeklyRoadmap} builds={data.buildRoadmap} />);
    expect(screen.getByText("W1")).toBeInTheDocument();
    expect(screen.getByText("W2")).toBeInTheDocument();
    expect(screen.getByText("W12")).toBeInTheDocument();
  });

  it("renders focus text", () => {
    render(<WeeklyRoadmap weeks={data.weeklyRoadmap} builds={data.buildRoadmap} />);
    expect(screen.getByText("Week 1 focus")).toBeInTheDocument();
    expect(screen.getByText("Week 12 focus")).toBeInTheDocument();
  });

  it("renders task items", () => {
    render(<WeeklyRoadmap weeks={data.weeklyRoadmap} builds={data.buildRoadmap} />);
    expect(screen.getByText("Task A for week 1")).toBeInTheDocument();
    expect(screen.getByText("Task B for week 1")).toBeInTheDocument();
  });

  it("shows empty message when weeks is empty", () => {
    render(<WeeklyRoadmap weeks={[]} builds={data.buildRoadmap} />);
    expect(screen.getByText("12-Week Roadmap")).toBeInTheDocument();
    expect(screen.getByText("No weekly roadmap available.")).toBeInTheDocument();
  });
});
