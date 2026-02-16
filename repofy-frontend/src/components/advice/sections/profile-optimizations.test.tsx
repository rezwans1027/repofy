import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfileOptimizations } from "./profile-optimizations";
import { createAdviceFixture } from "@/__tests__/fixtures";

describe("ProfileOptimizations", () => {
  const data = createAdviceFixture();

  it("renders Profile Optimizations header", () => {
    render(<ProfileOptimizations optimizations={data.profileOptimizations} />);
    expect(screen.getByText("Profile Optimizations")).toBeInTheDocument();
  });

  it("renders area names", () => {
    render(<ProfileOptimizations optimizations={data.profileOptimizations} />);
    expect(screen.getByText("Bio")).toBeInTheDocument();
  });

  it("renders Current label and value", () => {
    render(<ProfileOptimizations optimizations={data.profileOptimizations} />);
    expect(screen.getByText("Current")).toBeInTheDocument();
    expect(screen.getByText("Developer")).toBeInTheDocument();
  });

  it("renders Suggestion label and value", () => {
    render(<ProfileOptimizations optimizations={data.profileOptimizations} />);
    expect(screen.getByText("Suggestion")).toBeInTheDocument();
    expect(screen.getByText("Senior Full-Stack Engineer | TypeScript & Rust")).toBeInTheDocument();
  });
});
