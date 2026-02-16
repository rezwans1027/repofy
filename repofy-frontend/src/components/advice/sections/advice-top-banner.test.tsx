import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdviceTopBanner } from "./advice-top-banner";

describe("AdviceTopBanner", () => {
  it("renders the username", () => {
    render(<AdviceTopBanner username="testuser" />);
    expect(screen.getByText("@testuser")).toBeInTheDocument();
  });

  it("renders initials fallback when no avatar", () => {
    render(<AdviceTopBanner username="testuser" />);
    expect(screen.getByText("T")).toBeInTheDocument();
  });

  it("renders avatar image when avatarUrl is provided", () => {
    render(<AdviceTopBanner username="testuser" avatarUrl="https://example.com/avatar.jpg" />);
    expect(screen.getByAltText("testuser")).toBeInTheDocument();
  });

  it("renders Profile Advisor text", () => {
    render(<AdviceTopBanner username="testuser" />);
    expect(screen.getByText("Profile Advisor")).toBeInTheDocument();
  });

  it("renders Actionable Advice badge", () => {
    render(<AdviceTopBanner username="testuser" />);
    expect(screen.getByText("Actionable Advice")).toBeInTheDocument();
  });
});
