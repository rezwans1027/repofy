import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MetricBar } from "./metric-bar";

describe("MetricBar", () => {
  it("renders label text", () => {
    render(<MetricBar label="Code Quality" value={85} />);
    expect(screen.getByText("Code Quality")).toBeInTheDocument();
  });

  it("renders value text", () => {
    render(<MetricBar label="Complexity" value={72} />);
    expect(screen.getByText("72")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <MetricBar label="Score" value={60} className="mt-4" />,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain("mt-4");
    // Retains base class
    expect(wrapper.className).toContain("space-y-1.5");
  });

  it("works with custom max (percentage calculation)", () => {
    // value=50, max=200 -> percentage=25%
    const { container } = render(
      <MetricBar label="Metric" value={50} max={200} color="#22D3EE" />,
    );

    // The bar fill is the inner div inside the track.
    // Track is: div.h-2.w-full.overflow-hidden.rounded-full.bg-secondary
    const track = container.querySelector(".bg-secondary");
    expect(track).toBeInTheDocument();

    const fill = track!.firstElementChild as HTMLElement;
    expect(fill).toBeInTheDocument();
    // framer-motion is mocked, so whileInView becomes a no-op.
    // The motion.div renders as a plain <div> with the style prop.
    // jsdom normalizes hex colors to rgb() format
    expect(fill.style.backgroundColor).toBe("rgb(34, 211, 238)");
  });
});
