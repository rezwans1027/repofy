import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CareerPositioning } from "./career-positioning";

describe("CareerPositioning", () => {
  const data = {
    positioning: "Position yourself as a TypeScript-focused developer building toward full-stack production readiness.",
    roles: ["Junior Full-Stack Developer", "Junior Backend Engineer"],
    differentiators: [
      "Consistent commit cadence showing sustained effort.",
      "Clean TypeScript fundamentals with strict mode.",
    ],
  };

  it("renders Career Positioning header", () => {
    render(<CareerPositioning data={data} />);
    expect(screen.getByText("Career Positioning")).toBeInTheDocument();
  });

  it("renders positioning text", () => {
    render(<CareerPositioning data={data} />);
    expect(screen.getByText("Position yourself as a TypeScript-focused developer building toward full-stack production readiness.")).toBeInTheDocument();
  });

  it("renders role badges", () => {
    render(<CareerPositioning data={data} />);
    expect(screen.getByText("Junior Full-Stack Developer")).toBeInTheDocument();
    expect(screen.getByText("Junior Backend Engineer")).toBeInTheDocument();
  });

  it("renders differentiators", () => {
    render(<CareerPositioning data={data} />);
    expect(screen.getByText("Consistent commit cadence showing sustained effort.")).toBeInTheDocument();
    expect(screen.getByText("Clean TypeScript fundamentals with strict mode.")).toBeInTheDocument();
  });

  it("shows empty message when no positioning and no roles", () => {
    render(<CareerPositioning data={{ positioning: "", roles: [], differentiators: [] }} />);
    expect(screen.getByText("No career positioning available.")).toBeInTheDocument();
  });
});
