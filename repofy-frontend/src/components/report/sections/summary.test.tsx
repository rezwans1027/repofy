import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Summary } from "./summary";

describe("Summary", () => {
  it("renders the Executive Summary header", () => {
    render(<Summary summary="Great developer." />);
    expect(screen.getByText("Executive Summary")).toBeInTheDocument();
  });

  it("renders the summary text", () => {
    render(<Summary summary="A strong engineer with excellent code quality." />);
    expect(screen.getByText("A strong engineer with excellent code quality.")).toBeInTheDocument();
  });
});
