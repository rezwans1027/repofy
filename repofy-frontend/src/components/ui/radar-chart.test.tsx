import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RadarChart } from "./radar-chart";

const testData = [
  { axis: "Code Quality", value: 0.87 },
  { axis: "Complexity", value: 0.78 },
  { axis: "Breadth", value: 0.82 },
  { axis: "Practices", value: 0.74 },
  { axis: "Consistency", value: 0.91 },
  { axis: "Collaboration", value: 0.68 },
];

describe("RadarChart", () => {
  it("renders an SVG element", () => {
    const { container } = render(<RadarChart data={testData} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("renders label text elements for all axes", () => {
    const { container } = render(<RadarChart data={testData} />);
    const textElements = container.querySelectorAll("text");
    expect(textElements.length).toBe(testData.length);

    const labels = Array.from(textElements).map((el) => el.textContent);
    for (const d of testData) {
      expect(labels).toContain(d.axis);
    }
  });

  it("renders data points (circles) for each axis", () => {
    const { container } = render(<RadarChart data={testData} />);
    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBe(testData.length);
  });

  it("renders grid level paths", () => {
    const { container } = render(<RadarChart data={testData} />);
    // 5 grid levels + 1 data shape path = 6 paths
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBe(6);
  });

  it("renders axis lines", () => {
    const { container } = render(<RadarChart data={testData} />);
    const lines = container.querySelectorAll("line");
    expect(lines.length).toBe(testData.length);
  });

  it("accepts custom size prop", () => {
    const { container } = render(<RadarChart data={testData} size={400} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("viewBox", "0 0 400 400");
  });

  it("renders without crashing for a single data point", () => {
    const singleData = [{ axis: "Quality", value: 0.5 }];
    const { container } = render(<RadarChart data={singleData} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.querySelectorAll("text")).toHaveLength(1);
    expect(container.querySelectorAll("circle")).toHaveLength(1);
  });

  it("clamps rendering for values outside [0, 1]", () => {
    const outOfRange = [
      { axis: "Low", value: -0.5 },
      { axis: "High", value: 1.5 },
      { axis: "Normal", value: 0.5 },
    ];
    const { container } = render(<RadarChart data={outOfRange} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.querySelectorAll("circle")).toHaveLength(3);
  });
});
