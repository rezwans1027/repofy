import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ComparisonVerdict } from "./comparison-verdict";
import { createReportFixture } from "@/__tests__/fixtures";

describe("ComparisonVerdict", () => {
  const reportA = createReportFixture({ overallScore: 85 });
  const reportB = createReportFixture({ overallScore: 72, candidateLevel: "Mid-Level", recommendation: "Hire" });

  it("renders both usernames", () => {
    render(<ComparisonVerdict usernameA="alice" usernameB="bob" reportA={reportA} reportB={reportB} />);
    expect(screen.getAllByText("@alice")).toHaveLength(2);
    expect(screen.getByText("@bob")).toBeInTheDocument();
  });

  it("renders both scores", () => {
    render(<ComparisonVerdict usernameA="alice" usernameB="bob" reportA={reportA} reportB={reportB} />);
    expect(screen.getByText("85")).toBeInTheDocument();
    expect(screen.getByText("72")).toBeInTheDocument();
  });

  it("shows winner when scores differ significantly", () => {
    render(<ComparisonVerdict usernameA="alice" usernameB="bob" reportA={reportA} reportB={reportB} />);
    expect(screen.getByText(/leads by 13 points/)).toBeInTheDocument();
  });

  it("shows Closely Matched when scores are within 2", () => {
    const closeA = createReportFixture({ overallScore: 80 });
    const closeB = createReportFixture({ overallScore: 81 });
    render(<ComparisonVerdict usernameA="alice" usernameB="bob" reportA={closeA} reportB={closeB} />);
    expect(screen.getByText(/Closely Matched/)).toBeInTheDocument();
  });

  it("renders Key Differentiators section", () => {
    render(<ComparisonVerdict usernameA="alice" usernameB="bob" reportA={reportA} reportB={reportB} />);
    expect(screen.getByText("Key Differentiators")).toBeInTheDocument();
  });

  it("renders candidate level badges", () => {
    render(<ComparisonVerdict usernameA="alice" usernameB="bob" reportA={reportA} reportB={reportB} />);
    expect(screen.getByText("Senior")).toBeInTheDocument();
    expect(screen.getByText("Mid-Level")).toBeInTheDocument();
  });

  it("renders recommendation badges", () => {
    render(<ComparisonVerdict usernameA="alice" usernameB="bob" reportA={reportA} reportB={reportB} />);
    expect(screen.getByText("Strong Hire")).toBeInTheDocument();
    expect(screen.getByText("Hire")).toBeInTheDocument();
  });

  it("shows Closely Matched with 0 delta for equal scores", () => {
    const equalA = createReportFixture({ overallScore: 75 });
    const equalB = createReportFixture({ overallScore: 75 });
    render(<ComparisonVerdict usernameA="alice" usernameB="bob" reportA={equalA} reportB={equalB} />);
    expect(screen.getByText("Closely Matched (within 0 points)")).toBeInTheDocument();
    expect(screen.queryByText(/leads by/)).not.toBeInTheDocument();
  });

  it("shows comparable profiles when radar axes are identical", () => {
    const axes = [
      { axis: "Code Quality", value: 0.80 },
      { axis: "Project Complexity", value: 0.80 },
      { axis: "Technical Breadth", value: 0.80 },
      { axis: "Eng. Practices", value: 0.80 },
      { axis: "Consistency", value: 0.80 },
      { axis: "Collaboration", value: 0.80 },
    ];
    const identicalA = createReportFixture({ radarAxes: axes, stats: { ...createReportFixture().stats, stars: 100 } });
    const identicalB = createReportFixture({ radarAxes: axes, stats: { ...createReportFixture().stats, stars: 100 } });
    render(<ComparisonVerdict usernameA="alice" usernameB="bob" reportA={identicalA} reportB={identicalB} />);
    expect(screen.getByText(/Both candidates show comparable skill profiles across all axes/)).toBeInTheDocument();
  });

  it("shows traction text when stars ratio exceeds 1.5", () => {
    const highStarsReport = createReportFixture({ stats: { ...createReportFixture().stats, stars: 3000 } });
    const lowStarsReport = createReportFixture({ stats: { ...createReportFixture().stats, stars: 100 } });
    render(<ComparisonVerdict usernameA="alice" usernameB="bob" reportA={highStarsReport} reportB={lowStarsReport} />);
    expect(screen.getByText(/significantly more community traction/)).toBeInTheDocument();
  });

  it("applies correct score color classes based on boundaries", () => {
    const redReport = createReportFixture({ overallScore: 59 });
    const greenReport = createReportFixture({ overallScore: 80 });
    const { container } = render(
      <ComparisonVerdict usernameA="alice" usernameB="bob" reportA={redReport} reportB={greenReport} />
    );
    // Score spans use font-mono + text-lg + font-bold + color class
    const scoreSpan59 = container.querySelector("span.text-red-400.font-mono.text-lg");
    const scoreSpan80 = container.querySelector("span.text-emerald-400.font-mono.text-lg");
    expect(scoreSpan59).toBeInTheDocument();
    expect(scoreSpan59!.textContent).toBe("59");
    expect(scoreSpan80).toBeInTheDocument();
    expect(scoreSpan80!.textContent).toBe("80");
  });
});
