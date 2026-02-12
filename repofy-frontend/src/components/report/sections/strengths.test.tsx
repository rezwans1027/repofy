import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Strengths } from "./strengths";
import { createReportFixture } from "@/__tests__/fixtures";

describe("Strengths", () => {
  const data = createReportFixture();

  it("renders Strengths header", () => {
    render(<Strengths strengths={data.strengths} />);
    expect(screen.getByText("Strengths")).toBeInTheDocument();
  });

  it("renders strength text", () => {
    render(<Strengths strengths={data.strengths} />);
    expect(screen.getByText("Consistent commits")).toBeInTheDocument();
  });

  it("renders strength evidence", () => {
    render(<Strengths strengths={data.strengths} />);
    expect(screen.getByText("1847 contributions")).toBeInTheDocument();
  });
});
