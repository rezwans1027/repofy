import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    expect(screen.getByText("Standout")).toBeInTheDocument();
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
    expect(screen.getByText("Standout")).toBeInTheDocument();
  });

  it("expandAll shows content without chevron icons", () => {
    render(<TopRepos topRepos={data.topRepos} expandAll />);
    // When expandAll is true, content is already visible
    expect(screen.getByText("A test repository")).toBeInTheDocument();
    // ChevronDown icons are not rendered when expandAll is true
    // The component only renders ChevronDown when !expandAll
    const buttons = screen.getAllByRole("button");
    buttons.forEach((button) => {
      // In expandAll mode, there should be no rotate-180 or rotate class on chevrons
      // because ChevronDown is not rendered at all
      const chevrons = button.querySelectorAll("svg.size-4.text-muted-foreground");
      expect(chevrons.length).toBe(0);
    });
  });

  it("expandAll keeps content visible after clicking button", () => {
    render(<TopRepos topRepos={data.topRepos} expandAll />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    // Content should still be visible because expandAll prevents setExpanded
    expect(screen.getByText("A test repository")).toBeInTheDocument();
    expect(screen.getByText("Standout")).toBeInTheDocument();
  });

  it("toggle close hides details on second click", async () => {
    const user = userEvent.setup();
    render(<TopRepos topRepos={data.topRepos} />);
    // First click: expand
    await user.click(screen.getByRole("button"));
    expect(screen.getByText("A test repository")).toBeInTheDocument();
    // Re-query button (framer-motion mock recreates DOM on re-render)
    await user.click(screen.getByRole("button"));
    expect(screen.queryByText("A test repository")).not.toBeInTheDocument();
  });

  it("renders header only when topRepos is empty", () => {
    render(<TopRepos topRepos={[]} />);
    expect(screen.getByText("Top Repositories")).toBeInTheDocument();
    expect(screen.queryByText("test-repo")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
