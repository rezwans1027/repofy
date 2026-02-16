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

  it("renders header only when redFlags is empty", () => {
    render(<RedFlags redFlags={[]} />);
    expect(screen.getByText("Red Flags")).toBeInTheDocument();
    expect(screen.queryByText("Outdated dependencies")).not.toBeInTheDocument();
  });

  it("renders distinct badges for multiple severity levels", () => {
    const multiFlags = createReportFixture({
      redFlags: [
        { text: "Minor issue", severity: "Minor" as const, explanation: "Not a big deal." },
        { text: "Notable issue", severity: "Notable" as const, explanation: "Should address." },
        { text: "Concerning issue", severity: "Concerning" as const, explanation: "Needs attention." },
      ],
    });
    render(<RedFlags redFlags={multiFlags.redFlags} />);
    expect(screen.getByText("Minor")).toBeInTheDocument();
    expect(screen.getByText("Notable")).toBeInTheDocument();
    expect(screen.getByText("Concerning")).toBeInTheDocument();
  });

  it("renders without crash for unknown severity", () => {
    const unknownFlags = createReportFixture({
      redFlags: [
        { text: "Weird issue", severity: "Unknown" as never, explanation: "Mystery severity." },
      ],
    });
    render(<RedFlags redFlags={unknownFlags.redFlags} />);
    expect(screen.getByText("Weird issue")).toBeInTheDocument();
    expect(screen.getByText("Unknown")).toBeInTheDocument();
    expect(screen.getByText("Mystery severity.")).toBeInTheDocument();
  });
});
