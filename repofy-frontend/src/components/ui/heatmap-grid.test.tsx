import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { HeatmapGrid } from "./heatmap-grid";

// jsdom normalizes hex colors to rgb(), so expected values must match that.
// CSS custom properties (var(--...)) are kept as-is since jsdom can't resolve them.
const EXPECTED_COLORS = [
  "var(--secondary)",
  "rgb(6, 78, 59)",    // #064E3B
  "rgb(6, 95, 70)",    // #065F46
  "rgb(4, 120, 87)",   // #047857
  "rgb(34, 211, 238)", // #22D3EE
];

describe("HeatmapGrid", () => {
  it("renders correct cell count", () => {
    const data = [
      [0, 1],
      [2, 3],
      [4, 0],
    ];
    const { container } = render(<HeatmapGrid data={data} />);
    const grid = container.querySelector(".grid");
    // 3 rows x 2 cols = 6 cells
    expect(grid!.children).toHaveLength(6);
  });

  it("grid template columns match data width", () => {
    const data = [
      [0, 1, 2, 3, 4],
      [1, 2, 3, 4, 0],
    ];
    const { container } = render(<HeatmapGrid data={data} />);
    const grid = container.querySelector(".grid") as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe("repeat(5, 1fr)");
    expect(grid.style.gridTemplateRows).toBe("repeat(7, 1fr)");
  });

  it("applies correct background colors per value", () => {
    const data = [[0, 1, 2, 3, 4]];
    const { container } = render(<HeatmapGrid data={data} />);
    const grid = container.querySelector(".grid")!;
    const cells = Array.from(grid.children) as HTMLElement[];

    expect(cells).toHaveLength(5);
    cells.forEach((cell, i) => {
      expect(cell.style.backgroundColor).toBe(EXPECTED_COLORS[i]);
    });
  });

  it("handles empty data", () => {
    const data = [[]];
    const { container } = render(<HeatmapGrid data={data} />);
    const grid = container.querySelector(".grid")!;
    expect(grid.children).toHaveLength(0);
  });
});
