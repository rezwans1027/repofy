import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TopRepositories } from "./top-repositories";

describe("TopRepositories", () => {
  const repos = [
    {
      name: "awesome-project",
      description: "A really cool project",
      language: "TypeScript",
      languageColor: "#3178c6",
      stars: 120,
      forks: 15,
      updatedAt: "2 days ago",
      topics: ["react", "nextjs"],
      url: "https://github.com/user/awesome-project",
    },
    {
      name: "cli-tool",
      description: "Command line utility",
      language: "Rust",
      languageColor: "#dea584",
      stars: 45,
      forks: 3,
      updatedAt: "1 week ago",
      topics: [],
    },
  ];

  it("renders 'Top Repositories' header", () => {
    render(<TopRepositories repos={repos} />);
    expect(screen.getByText("Top Repositories")).toBeInTheDocument();
  });

  it("renders repo names", () => {
    render(<TopRepositories repos={repos} />);
    expect(screen.getByText("awesome-project")).toBeInTheDocument();
    expect(screen.getByText("cli-tool")).toBeInTheDocument();
  });

  it("shows descriptions", () => {
    render(<TopRepositories repos={repos} />);
    expect(screen.getByText("A really cool project")).toBeInTheDocument();
    expect(screen.getByText("Command line utility")).toBeInTheDocument();
  });

  it("renders topics as badges", () => {
    render(<TopRepositories repos={repos} />);
    expect(screen.getByText("react")).toBeInTheDocument();
    expect(screen.getByText("nextjs")).toBeInTheDocument();
  });

  it("renders link when url is valid https", () => {
    render(<TopRepositories repos={repos} />);
    const link = screen.getByText("awesome-project").closest("a");
    expect(link).toHaveAttribute("href", "https://github.com/user/awesome-project");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("renders h3 (no link) when url is missing", () => {
    render(<TopRepositories repos={repos} />);
    const heading = screen.getByText("cli-tool");
    expect(heading.tagName).toBe("H3");
    expect(heading.closest("a")).toBeNull();
  });
});
