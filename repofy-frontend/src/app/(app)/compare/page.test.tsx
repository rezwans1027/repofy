import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import ComparePage from "./page";

describe("ComparePage", () => {
  it("shows Coming Soon card with correct content", () => {
    render(<ComparePage />);
    expect(screen.getByText("Coming Soon")).toBeInTheDocument();
    expect(screen.getByText("Compare")).toBeInTheDocument();
    expect(
      screen.getByText(/Side-by-side candidate comparison is coming soon/),
    ).toBeInTheDocument();
  });
});
