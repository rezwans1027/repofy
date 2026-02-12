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
});
