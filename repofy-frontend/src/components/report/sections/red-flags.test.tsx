import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RedFlags } from "./red-flags";
import { createReportFixture } from "@/__tests__/fixtures";

describe("RedFlags", () => {
  const data = createReportFixture();

  it("renders Red Flags header", () => {
    render(<RedFlags redFlags={data.redFlags} />);
    expect(screen.getByText("Red Flags")).toBeInTheDocument();
  });

  it("renders flag text", () => {
    render(<RedFlags redFlags={data.redFlags} />);
    expect(screen.getByText("Outdated dependencies")).toBeInTheDocument();
  });

  it("renders severity badge", () => {
    render(<RedFlags redFlags={data.redFlags} />);
    expect(screen.getByText("Minor")).toBeInTheDocument();
  });

  it("renders explanation", () => {
    render(<RedFlags redFlags={data.redFlags} />);
    expect(screen.getByText("Common in personal projects.")).toBeInTheDocument();
  });
});
