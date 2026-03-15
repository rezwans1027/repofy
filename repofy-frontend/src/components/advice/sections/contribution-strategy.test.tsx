import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ContributionStrategy } from "./contribution-strategy";

describe("ContributionStrategy", () => {
  const items = [
    {
      title: "Contribute to popular OSS",
      detail: "Start with documentation fixes to build reputation.",
      evidence: "No external contributions visible on profile.",
    },
    {
      title: "Fix beginner-friendly issues",
      detail: "Look for good-first-issue tags in major repos.",
      evidence: "No issue activity detected.",
    },
  ];

  it("renders Contribution Strategy header", () => {
    render(<ContributionStrategy items={items} />);
    expect(screen.getByText("Contribution Strategy")).toBeInTheDocument();
  });

  it("renders item titles", () => {
    render(<ContributionStrategy items={items} />);
    expect(screen.getByText("Contribute to popular OSS")).toBeInTheDocument();
    expect(screen.getByText("Fix beginner-friendly issues")).toBeInTheDocument();
  });

  it("renders detail and evidence", () => {
    render(<ContributionStrategy items={items} />);
    expect(screen.getByText("Start with documentation fixes to build reputation.")).toBeInTheDocument();
    expect(screen.getByText("No external contributions visible on profile.")).toBeInTheDocument();
  });

  it("shows empty state when array empty", () => {
    render(<ContributionStrategy items={[]} />);
    expect(screen.getByText("Contribution Strategy")).toBeInTheDocument();
    expect(screen.getByText("No contribution strategy available.")).toBeInTheDocument();
  });
});
