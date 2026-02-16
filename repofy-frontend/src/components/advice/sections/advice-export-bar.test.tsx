import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AdviceExportBar } from "./advice-export-bar";
import { createRef } from "react";

vi.mock("@/lib/export-pdf", () => ({
  exportToPdf: vi.fn().mockResolvedValue(undefined),
}));

describe("AdviceExportBar", () => {
  const ref = createRef<HTMLDivElement>();

  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it("does not call exportToPdf when ref is null", async () => {
    const { exportToPdf } = await import("@/lib/export-pdf");
    const nullRef = { current: null };
    render(
      <AdviceExportBar username="testuser" adviceRef={nullRef} onBeforeExport={vi.fn()} onAfterExport={vi.fn()} />
    );
    await fireEvent.click(screen.getByText("Export PDF"));
    expect(exportToPdf).not.toHaveBeenCalled();
  });

  it("calls onAfterExport after successful export", async () => {
    const div = document.createElement("div");
    const divRef = { current: div };
    const onAfter = vi.fn();
    render(
      <AdviceExportBar username="testuser" adviceRef={divRef} onBeforeExport={vi.fn()} onAfterExport={onAfter} />
    );
    await fireEvent.click(screen.getByText("Export PDF"));
    await waitFor(() => {
      expect(onAfter).toHaveBeenCalled();
    });
  });
});
