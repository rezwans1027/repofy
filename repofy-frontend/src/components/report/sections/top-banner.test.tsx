import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TopBanner } from "./top-banner";
import { createReportFixture } from "@/__tests__/fixtures";

describe("TopBanner", () => {
  const data = createReportFixture();

  it("renders the username", () => {
    render(<TopBanner username="testuser" data={data} />);
    expect(screen.getByText("@testuser")).toBeInTheDocument();
  });

  it("renders initials fallback when no avatar", () => {
    render(<TopBanner username="testuser" data={data} />);
    expect(screen.getByText("T")).toBeInTheDocument();
  });

  it("renders avatar image when avatarUrl is provided", () => {
    render(<TopBanner username="testuser" avatarUrl="https://example.com/avatar.jpg" data={data} />);
    expect(screen.getByAltText("testuser")).toBeInTheDocument();
  });

  it("renders candidateLevel badge", () => {
    render(<TopBanner username="testuser" data={data} />);
    expect(screen.getByText("Senior")).toBeInTheDocument();
  });

  it("renders recommendation badge", () => {
    render(<TopBanner username="testuser" data={data} />);
    expect(screen.getByText("Strong Hire")).toBeInTheDocument();
  });

  it("renders Overall Score label", () => {
    render(<TopBanner username="testuser" data={data} />);
    expect(screen.getByText("Overall Score")).toBeInTheDocument();
  });

  it("applies emerald color for score >= 80", () => {
    const highData = createReportFixture({ overallScore: 85 });
    const { container } = render(<TopBanner username="testuser" data={highData} />);
    const scoreEl = container.querySelector(".text-emerald-400");
    expect(scoreEl).toBeInTheDocument();
  });

  it("applies yellow color for score >= 60 and < 80", () => {
    const midData = createReportFixture({ overallScore: 65 });
    const { container } = render(<TopBanner username="testuser" data={midData} />);
    const scoreEl = container.querySelector(".text-yellow-400");
    expect(scoreEl).toBeInTheDocument();
  });

  it("applies red color for score < 60", () => {
    const lowData = createReportFixture({ overallScore: 45 });
    const { container } = render(<TopBanner username="testuser" data={lowData} />);
    const scoreEl = container.querySelector(".text-red-400");
    expect(scoreEl).toBeInTheDocument();
  });
});
