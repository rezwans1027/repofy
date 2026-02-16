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
    expect(dashes).toHaveLength(6);
  });

  it("shows both percentages for shared language", () => {
    const sharedB = createReportFixture({
      languageProfile: {
        languages: [
          { name: "TypeScript", color: "#3178C6", percentage: 45, repos: 10 },
          { name: "Python", color: "#3572A5", percentage: 30, repos: 8 },
        ],
        interpretation: "Mixed profile.",
      },
    });
    render(<ComparisonLanguages reportA={reportA} reportB={sharedB} usernameA="alice" usernameB="bob" />);
    // TypeScript is shared: A has 38%, B has 45% — neither should be "—"
    expect(screen.getByText("38%")).toBeInTheDocument();
    expect(screen.getByText("45%")).toBeInTheDocument();
  });

  it("sorts languages by max percentage descending", () => {
    const { container } = render(
      <ComparisonLanguages reportA={reportA} reportB={reportB} usernameA="alice" usernameB="bob" />
    );
    // Python has max 50%, TypeScript has max 38%, Rust has max 27%
    // So first row should be Python, second TypeScript, third Rust
    const rows = container.querySelectorAll("tbody tr");
    expect(rows[0].textContent).toContain("Python");
    expect(rows[1].textContent).toContain("TypeScript");
    expect(rows[2].textContent).toContain("Rust");
  });

  it("displays dash for 0 repos", () => {
    // Python is only in B, so A repos = 0 → should show "—"
    // Rust is only in A, so B repos = 0 → should show "—"
    const { container } = render(
      <ComparisonLanguages reportA={reportA} reportB={reportB} usernameA="alice" usernameB="bob" />
    );
    // Find the Python row and verify A repos cell shows "—"
    const rows = container.querySelectorAll("tbody tr");
    const pythonRow = Array.from(rows).find((r) => r.textContent?.includes("Python"))!;
    const cells = pythonRow.querySelectorAll("td");
    // cells: [Language, A%, B%, A Repos, B Repos]
    // Python: A has 0 repos → cells[3] should be "—"
    expect(cells[3].textContent).toBe("—");
  });
});
