import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Summary } from "./summary";

describe("Summary", () => {
  it("renders the Executive Summary header", () => {
    render(<Summary narrativeReport="Great developer." />);
    expect(screen.getByText("Executive Summary")).toBeInTheDocument();
  });

  it("renders the narrative report text", () => {
    render(<Summary narrativeReport="A strong engineer with excellent code quality." />);
    expect(screen.getByText("A strong engineer with excellent code quality.")).toBeInTheDocument();
  });

  it("renders multi-paragraph narrative", () => {
    render(<Summary narrativeReport={"First paragraph.\n\nSecond paragraph."} />);
    expect(screen.getByText("First paragraph.")).toBeInTheDocument();
    expect(screen.getByText("Second paragraph.")).toBeInTheDocument();
  });

  it("renders without crash for empty string", () => {
    render(<Summary narrativeReport="" />);
    expect(screen.getByText("Executive Summary")).toBeInTheDocument();
  });

  it("strips markdown headers from narrative", () => {
    render(<Summary narrativeReport={"## Overall Assessment\n\nThis is the assessment."} />);
    expect(screen.queryByText(/^##/)).not.toBeInTheDocument();
    expect(screen.getByText("This is the assessment.")).toBeInTheDocument();
  });

  it("strips bold and italic markdown", () => {
    render(<Summary narrativeReport={"This is **bold** and *italic* text."} />);
    expect(screen.getByText("This is bold and italic text.")).toBeInTheDocument();
  });

  it("strips bullet points from narrative", () => {
    render(<Summary narrativeReport={"Key points:\n\n- First point\n- Second point"} />);
    expect(screen.queryByText(/^-/)).not.toBeInTheDocument();
    expect(screen.getByText(/First point/)).toBeInTheDocument();
  });

  it("joins single newlines within a paragraph", () => {
    render(<Summary narrativeReport={"Line one.\nLine two.\nLine three."} />);
    expect(screen.getByText("Line one. Line two. Line three.")).toBeInTheDocument();
  });
});
