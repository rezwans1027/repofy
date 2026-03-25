import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrajectorySection } from "./trajectory";
import { createAdviceFixture } from "@/__tests__/fixtures";

describe("TrajectorySection", () => {
  const data = createAdviceFixture();

  it("renders Career Trajectory header", () => {
    render(<TrajectorySection trajectory={data.trajectory} />);
    expect(screen.getByText("Career Trajectory")).toBeInTheDocument();
  });

  it("renders current and target estimates", () => {
    render(<TrajectorySection trajectory={data.trajectory} />);
    expect(screen.getByText("Junior")).toBeInTheDocument();
    expect(screen.getByText("Mid-Level")).toBeInTheDocument();
  });

  it("renders confidence badge", () => {
    render(<TrajectorySection trajectory={data.trajectory} />);
    expect(screen.getByText("Medium confidence")).toBeInTheDocument();
  });

  it("renders rationale text", () => {
    render(<TrajectorySection trajectory={data.trajectory} />);
    expect(screen.getByText(data.trajectory.rationale)).toBeInTheDocument();
  });

  it("renders calibration entries", () => {
    render(<TrajectorySection trajectory={data.trajectory} />);
    expect(screen.getByText("Complexity")).toBeInTheDocument();
    expect(screen.getByText("Moderate complexity projects.")).toBeInTheDocument();
    expect(screen.getByText("Breadth")).toBeInTheDocument();
    expect(screen.getByText("TypeScript and JavaScript only.")).toBeInTheDocument();
    expect(screen.getByText("Collaboration")).toBeInTheDocument();
    expect(screen.getByText("Single-contributor repos.")).toBeInTheDocument();
    expect(screen.getByText("Engineering Practices")).toBeInTheDocument();
    expect(screen.getByText("No tests or CI detected.")).toBeInTheDocument();
    expect(screen.getByText("Consistency")).toBeInTheDocument();
    expect(screen.getByText("Active pushes within 60 days.")).toBeInTheDocument();
  });
});
