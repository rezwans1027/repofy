import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ComparisonExportBar } from "./comparison-export-bar";
import { createRef } from "react";

vi.mock("@/lib/export-pdf", () => ({
  exportToPdf: vi.fn().mockResolvedValue(undefined),
}));

describe("ComparisonExportBar", () => {
  const ref = createRef<HTMLDivElement>();

  it("renders both usernames", () => {
    render(<ComparisonExportBar usernameA="alice" usernameB="bob" comparisonRef={ref} />);
    expect(screen.getByText("@alice")).toBeInTheDocument();
    expect(screen.getByText("@bob")).toBeInTheDocument();
  });

  it("renders Export Comparison PDF button", () => {
    render(<ComparisonExportBar usernameA="alice" usernameB="bob" comparisonRef={ref} />);
    expect(screen.getByText("Export Comparison PDF")).toBeInTheDocument();
  });

  it("shows loading state when clicked with ref", () => {
    const div = document.createElement("div");
    const divRef = { current: div };
    render(<ComparisonExportBar usernameA="alice" usernameB="bob" comparisonRef={divRef} />);
    fireEvent.click(screen.getByText("Export Comparison PDF"));
    expect(screen.getByText("Exporting...")).toBeInTheDocument();
  });

  it("does not call exportToPdf when ref is null", async () => {
    const { exportToPdf } = await import("@/lib/export-pdf");
    const nullRef = { current: null };
    render(<ComparisonExportBar usernameA="alice" usernameB="bob" comparisonRef={nullRef} />);
    await fireEvent.click(screen.getByText("Export Comparison PDF"));
    // Button text should remain unchanged (not switch to "Exporting...")
    expect(screen.getByText("Export Comparison PDF")).toBeInTheDocument();
    expect(exportToPdf).not.toHaveBeenCalled();
  });
});
