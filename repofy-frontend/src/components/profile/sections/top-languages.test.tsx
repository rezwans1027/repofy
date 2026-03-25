import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TopLanguages } from "./top-languages";

describe("TopLanguages", () => {
  const languages = [
    { name: "TypeScript", color: "#3178c6", percentage: 55, repoCount: 12 },
    { name: "Python", color: "#3572A5", percentage: 30 },
    { name: "Rust", color: "#dea584", percentage: 15, repoCount: 3 },
  ];

  it("renders 'Top Languages' header", () => {
    render(<TopLanguages languages={languages} />);
    expect(screen.getByText("Top Languages")).toBeInTheDocument();
  });

  it("renders each language name", () => {
    render(<TopLanguages languages={languages} />);
    expect(screen.getByText(/TypeScript/)).toBeInTheDocument();
    expect(screen.getByText(/Python/)).toBeInTheDocument();
    expect(screen.getByText(/Rust/)).toBeInTheDocument();
  });

  it("shows percentage for each language", () => {
    render(<TopLanguages languages={languages} />);
    expect(screen.getByText("55%")).toBeInTheDocument();
    expect(screen.getByText("30%")).toBeInTheDocument();
    expect(screen.getByText("15%")).toBeInTheDocument();
  });

  it("shows repoCount when provided", () => {
    render(<TopLanguages languages={languages} />);
    expect(screen.getByText("(12)")).toBeInTheDocument();
    expect(screen.getByText("(3)")).toBeInTheDocument();
  });
});
