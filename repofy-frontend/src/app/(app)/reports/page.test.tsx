import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import ReportsPage from "./page";

describe("ReportsPage", () => {
  it("shows Coming Soon card with correct content", () => {
    render(<ReportsPage />);
    expect(screen.getByText("Coming Soon")).toBeInTheDocument();
    expect(screen.getByText("Reports")).toBeInTheDocument();
    expect(
      screen.getByText(/AI-powered candidate evaluations are coming soon/),
    ).toBeInTheDocument();
  });
});
