import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageProfile } from "./language-profile";
import { createReportFixture } from "@/__tests__/fixtures";

describe("LanguageProfile", () => {
  const data = createReportFixture();

  it("renders Language Profile header", () => {
    render(<LanguageProfile languageProfile={data.languageProfile} />);
    expect(screen.getByText("Language Profile")).toBeInTheDocument();
  });

  it("renders language names", () => {
    render(<LanguageProfile languageProfile={data.languageProfile} />);
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("Rust")).toBeInTheDocument();
  });

  it("renders language percentages", () => {
    render(<LanguageProfile languageProfile={data.languageProfile} />);
    expect(screen.getByText("38%")).toBeInTheDocument();
    expect(screen.getByText("27%")).toBeInTheDocument();
  });

  it("renders repo counts", () => {
    render(<LanguageProfile languageProfile={data.languageProfile} />);
    expect(screen.getByText(/18 repos/)).toBeInTheDocument();
    expect(screen.getByText(/12 repos/)).toBeInTheDocument();
  });

  it("renders interpretation text", () => {
    render(<LanguageProfile languageProfile={data.languageProfile} />);
    expect(screen.getByText("TypeScript and Rust dominate.")).toBeInTheDocument();
  });
});
