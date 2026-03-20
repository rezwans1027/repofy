import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdviceEmptyState } from "./advice-empty-state";

describe("AdviceEmptyState", () => {
  it("renders title", () => {
    render(<AdviceEmptyState title="Test Section" message="Nothing here." />);
    expect(screen.getByText("Test Section")).toBeInTheDocument();
  });

  it("renders message text", () => {
    render(<AdviceEmptyState title="Test Section" message="No data available for this section." />);
    expect(screen.getByText("No data available for this section.")).toBeInTheDocument();
  });
});
