import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PrActivity } from "./pr-activity";

describe("PrActivity", () => {
  const prActivity = {
    opened: 20,
    merged: 15,
    reviewed: 30,
  };

  it("renders 'Pull Request Activity' header", () => {
    render(<PrActivity prActivity={prActivity} />);
    expect(screen.getByText("Pull Request Activity")).toBeInTheDocument();
  });

  it("renders all 4 stat labels including Merge Rate", () => {
    render(<PrActivity prActivity={prActivity} />);
    expect(screen.getByText("Opened")).toBeInTheDocument();
    expect(screen.getByText("Merged")).toBeInTheDocument();
    expect(screen.getByText("Reviewed")).toBeInTheDocument();
    expect(screen.getByText("Merge Rate")).toBeInTheDocument();
  });
});
