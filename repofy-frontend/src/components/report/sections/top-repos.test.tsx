import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TopRepos } from "./top-repos";
import { createReportFixture } from "@/__tests__/fixtures";

describe("TopRepos", () => {
  const data = createReportFixture();

  it("renders Top Repositories header", () => {
    render(<TopRepos topRepos={data.topRepos} />);
    expect(screen.getByText("Top Repositories")).toBeInTheDocument();
  });

  it("renders repo names", () => {
    render(<TopRepos topRepos={data.topRepos} />);
    expect(screen.getByText("test-repo")).toBeInTheDocument();
  });

  it("renders Best Work badge for isBestWork repos", () => {
    render(<TopRepos topRepos={data.topRepos} />);
    expect(screen.getByText("Best Work")).toBeInTheDocument();
  });

  it("renders star count", () => {
    render(<TopRepos topRepos={data.topRepos} />);
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("expands repo on click and shows details", () => {
    render(<TopRepos topRepos={data.topRepos} />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(screen.getByText("A test repository")).toBeInTheDocument();
    expect(screen.getByText("typescript")).toBeInTheDocument();
    expect(screen.getByText("Good project.")).toBeInTheDocument();
  });

  it("shows grade labels when expanded", () => {
    render(<TopRepos topRepos={data.topRepos} />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("Code Quality")).toBeInTheDocument();
    expect(screen.getByText("Testing")).toBeInTheDocument();
    expect(screen.getByText("CI/CD")).toBeInTheDocument();
  });

  it("shows all repos expanded when expandAll is true", () => {
    render(<TopRepos topRepos={data.topRepos} expandAll />);
    expect(screen.getByText("A test repository")).toBeInTheDocument();
    expect(screen.getByText("Good project.")).toBeInTheDocument();
  });
});
