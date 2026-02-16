import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdviceSummary } from "./advice-summary";

describe("AdviceSummary", () => {
  it("renders Summary header", () => {
    render(<AdviceSummary summary="Some advice." />);
    expect(screen.getByText("Summary")).toBeInTheDocument();
  });

  it("renders summary text", () => {
    render(<AdviceSummary summary="Focus on testing and open-source contributions." />);
    expect(screen.getByText("Focus on testing and open-source contributions.")).toBeInTheDocument();
  });
});
