import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ContributionAdvice } from "./contribution-advice";
import { createAdviceFixture } from "@/__tests__/fixtures";

describe("ContributionAdvice", () => {
  const data = createAdviceFixture();

  it("renders Contribution Advice header", () => {
    render(<ContributionAdvice items={data.contributionAdvice} />);
    expect(screen.getByText("Contribution Advice")).toBeInTheDocument();
  });

  it("renders item titles", () => {
    render(<ContributionAdvice items={data.contributionAdvice} />);
    expect(screen.getByText("Contribute to popular OSS")).toBeInTheDocument();
  });

  it("renders item details", () => {
    render(<ContributionAdvice items={data.contributionAdvice} />);
    expect(screen.getByText("Start with documentation fixes to build reputation.")).toBeInTheDocument();
  });
});
