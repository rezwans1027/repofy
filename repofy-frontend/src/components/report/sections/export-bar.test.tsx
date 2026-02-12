import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExportBar } from "./export-bar";
import { createRef } from "react";

vi.mock("@/lib/export-pdf", () => ({
  exportToPdf: vi.fn().mockResolvedValue(undefined),
}));

describe("ExportBar", () => {
  const ref = createRef<HTMLDivElement>();

  it("renders username display", () => {
    render(
      <ExportBar username="testuser" reportRef={ref} onBeforeExport={vi.fn()} onAfterExport={vi.fn()} />
    );
    expect(screen.getByText("@testuser")).toBeInTheDocument();
  });

  it("renders Export PDF button", () => {
    render(
      <ExportBar username="testuser" reportRef={ref} onBeforeExport={vi.fn()} onAfterExport={vi.fn()} />
    );
    expect(screen.getByText("Export PDF")).toBeInTheDocument();
  });

  it("renders Re-run link", () => {
    render(
      <ExportBar username="testuser" reportRef={ref} onBeforeExport={vi.fn()} onAfterExport={vi.fn()} />
    );
    expect(screen.getByText("Re-run")).toBeInTheDocument();
  });

  it("Re-run link has correct href", () => {
    render(
      <ExportBar username="testuser" reportRef={ref} onBeforeExport={vi.fn()} onAfterExport={vi.fn()} />
    );
    const link = screen.getByText("Re-run").closest("a");
    expect(link).toHaveAttribute("href", "/generate/testuser");
  });

  it("calls exportToPdf when Export PDF is clicked", async () => {
    const { exportToPdf } = await import("@/lib/export-pdf");
    const div = document.createElement("div");
    const divRef = { current: div };
    const onBefore = vi.fn();
    const onAfter = vi.fn();

    render(
      <ExportBar username="testuser" reportRef={divRef} onBeforeExport={onBefore} onAfterExport={onAfter} />
    );
    fireEvent.click(screen.getByText("Export PDF"));

    expect(onBefore).toHaveBeenCalled();
  });
});
