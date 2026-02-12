import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Weaknesses } from "./weaknesses";
import { createReportFixture } from "@/__tests__/fixtures";

describe("Weaknesses", () => {
  const data = createReportFixture();

  it("renders Areas for Improvement header", () => {
    render(<Weaknesses weaknesses={data.weaknesses} />);
    expect(screen.getByText("Areas for Improvement")).toBeInTheDocument();
  });

  it("renders weakness text", () => {
    render(<Weaknesses weaknesses={data.weaknesses} />);
    expect(screen.getByText("Testing varies")).toBeInTheDocument();
  });

  it("renders weakness evidence", () => {
    render(<Weaknesses weaknesses={data.weaknesses} />);
    expect(screen.getByText("45-78% coverage")).toBeInTheDocument();
  });
});
