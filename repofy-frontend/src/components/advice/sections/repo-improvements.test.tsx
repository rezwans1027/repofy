import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RepoImprovements } from "./repo-improvements";
import { createAdviceFixture } from "@/__tests__/fixtures";

describe("RepoImprovements", () => {
  const data = createAdviceFixture();

  it("renders Repo Improvements header", () => {
    render(<RepoImprovements repoImprovements={data.repoImprovements} />);
    expect(screen.getByText("Repository Improvements")).toBeInTheDocument();
  });

  it("renders repo names", () => {
    render(<RepoImprovements repoImprovements={data.repoImprovements} />);
    expect(screen.getByText("test-repo")).toBeInTheDocument();
  });

  it("renders improvement count badge", () => {
    render(<RepoImprovements repoImprovements={data.repoImprovements} />);
    expect(screen.getByText("2 improvements")).toBeInTheDocument();
  });

  it("expands to show improvements on click", () => {
    render(<RepoImprovements repoImprovements={data.repoImprovements} />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("Add integration tests for API routes.")).toBeInTheDocument();
  });

  it("shows priority badges when expanded", () => {
    render(<RepoImprovements repoImprovements={data.repoImprovements} />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("Medium")).toBeInTheDocument();
  });

  it("shows all repos expanded when expandAll is true", () => {
    render(<RepoImprovements repoImprovements={data.repoImprovements} expandAll />);
    expect(screen.getByText("Add integration tests for API routes.")).toBeInTheDocument();
  });

  it("collapses improvements on second click", async () => {
    const user = userEvent.setup();
    render(<RepoImprovements repoImprovements={data.repoImprovements} />);
    // First click expands
    await user.click(screen.getByRole("button"));
    expect(screen.getByText("Add integration tests for API routes.")).toBeInTheDocument();
    // Re-query button (framer-motion mock recreates DOM on re-render)
    await user.click(screen.getByRole("button"));
    expect(screen.queryByText("Add integration tests for API routes.")).not.toBeInTheDocument();
  });

  it("renders header but no repo names for empty array", () => {
    render(<RepoImprovements repoImprovements={[]} />);
    expect(screen.getByText("Repository Improvements")).toBeInTheDocument();
    expect(screen.queryByText("test-repo")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows improvement area labels when expanded", () => {
    render(<RepoImprovements repoImprovements={data.repoImprovements} />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText(/Testing:/)).toBeInTheDocument();
    expect(screen.getByText(/Documentation:/)).toBeInTheDocument();
  });
});
