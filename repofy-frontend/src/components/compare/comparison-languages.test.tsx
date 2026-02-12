import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ComparisonLanguages } from "./comparison-languages";
import { createReportFixture } from "@/__tests__/fixtures";

describe("ComparisonLanguages", () => {
  const reportA = createReportFixture();
  const reportB = createReportFixture({
    languageProfile: {
      languages: [
        { name: "Python", color: "#3572A5", percentage: 50, repos: 15 },
      ],
      interpretation: "Python focused.",
    },
  });

  it("renders Language Profile header", () => {
    render(<ComparisonLanguages reportA={reportA} reportB={reportB} usernameA="alice" usernameB="bob" />);
    expect(screen.getByText("Language Profile")).toBeInTheDocument();
  });

  it("renders both usernames in bars", () => {
    render(<ComparisonLanguages reportA={reportA} reportB={reportB} usernameA="alice" usernameB="bob" />);
    expect(screen.getByText("@alice")).toBeInTheDocument();
    expect(screen.getByText("@bob")).toBeInTheDocument();
  });

  it("renders language names from both reports", () => {
    render(<ComparisonLanguages reportA={reportA} reportB={reportB} usernameA="alice" usernameB="bob" />);
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("Python")).toBeInTheDocument();
  });

  it("renders dash for missing language values", () => {
    render(<ComparisonLanguages reportA={reportA} reportB={reportB} usernameA="alice" usernameB="bob" />);
    // Rust is in A but not B, so B should show "—"
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThan(0);
  });
});
