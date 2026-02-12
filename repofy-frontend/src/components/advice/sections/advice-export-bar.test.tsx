import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AdviceExportBar } from "./advice-export-bar";
import { createRef } from "react";

vi.mock("@/lib/export-pdf", () => ({
  exportToPdf: vi.fn().mockResolvedValue(undefined),
}));

describe("AdviceExportBar", () => {
  const ref = createRef<HTMLDivElement>();

  it("renders username display", () => {
    render(
      <AdviceExportBar username="testuser" adviceRef={ref} onBeforeExport={vi.fn()} onAfterExport={vi.fn()} />
    );
    expect(screen.getByText("@testuser")).toBeInTheDocument();
  });

  it("renders Run Again button", () => {
    render(
      <AdviceExportBar username="testuser" adviceRef={ref} onBeforeExport={vi.fn()} onAfterExport={vi.fn()} />
    );
    expect(screen.getByText("Run Again")).toBeInTheDocument();
  });

  it("renders Export PDF button", () => {
    render(
      <AdviceExportBar username="testuser" adviceRef={ref} onBeforeExport={vi.fn()} onAfterExport={vi.fn()} />
    );
    expect(screen.getByText("Export PDF")).toBeInTheDocument();
  });

  it("calls onBeforeExport when Export PDF is clicked", async () => {
    const div = document.createElement("div");
    const divRef = { current: div };
    const onBefore = vi.fn();
    render(
      <AdviceExportBar username="testuser" adviceRef={divRef} onBeforeExport={onBefore} onAfterExport={vi.fn()} />
    );
    await fireEvent.click(screen.getByText("Export PDF"));
    expect(onBefore).toHaveBeenCalled();
  });
});
