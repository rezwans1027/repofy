import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StrengthsAndGaps } from "./strengths-and-gaps";

describe("StrengthsAndGaps", () => {
  const data = {
    strengths: [
      { area: "Clean Code", detail: "Consistent naming in test-repo." },
      { area: "Consistency", detail: "Regular pushes in last 60 days." },
    ],
    gaps: [
      { area: "Testing", detail: "No test files found." },
      { area: "CI/CD", detail: "No pipelines detected." },
    ],
  };

  it("renders Strengths & Gaps header", () => {
    render(<StrengthsAndGaps data={data} />);
    expect(screen.getByText("Strengths & Gaps")).toBeInTheDocument();
  });

  it("renders strength areas and details", () => {
    render(<StrengthsAndGaps data={data} />);
    expect(screen.getByText("Clean Code")).toBeInTheDocument();
    expect(screen.getByText("Consistent naming in test-repo.")).toBeInTheDocument();
    expect(screen.getByText("Consistency")).toBeInTheDocument();
    expect(screen.getByText("Regular pushes in last 60 days.")).toBeInTheDocument();
  });

  it("renders gap areas and details", () => {
    render(<StrengthsAndGaps data={data} />);
    expect(screen.getByText("Testing")).toBeInTheDocument();
    expect(screen.getByText("No test files found.")).toBeInTheDocument();
    expect(screen.getByText("CI/CD")).toBeInTheDocument();
    expect(screen.getByText("No pipelines detected.")).toBeInTheDocument();
  });

  it("shows empty message when both arrays empty", () => {
    render(<StrengthsAndGaps data={{ strengths: [], gaps: [] }} />);
    expect(screen.getByText("No strengths and gaps analysis available.")).toBeInTheDocument();
  });
});
