import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectIdeas } from "./project-ideas";
import { createAdviceFixture } from "@/__tests__/fixtures";

describe("ProjectIdeas", () => {
  const data = createAdviceFixture();

  it("renders Project Ideas header", () => {
    render(<ProjectIdeas projectIdeas={data.projectIdeas} />);
    expect(screen.getByText("Project Ideas")).toBeInTheDocument();
  });

  it("renders idea titles", () => {
    render(<ProjectIdeas projectIdeas={data.projectIdeas} />);
    expect(screen.getByText("Real-time Chat App")).toBeInTheDocument();
  });

  it("renders difficulty badges", () => {
    render(<ProjectIdeas projectIdeas={data.projectIdeas} />);
    expect(screen.getByText("Intermediate")).toBeInTheDocument();
  });

  it("renders tech stack badges", () => {
    render(<ProjectIdeas projectIdeas={data.projectIdeas} />);
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("Node.js")).toBeInTheDocument();
    expect(screen.getByText("Redis")).toBeInTheDocument();
  });

  it("renders why text", () => {
    render(<ProjectIdeas projectIdeas={data.projectIdeas} />);
    expect(screen.getByText("Demonstrates real-time architecture skills.")).toBeInTheDocument();
  });
});
