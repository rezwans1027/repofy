import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BuildRoadmap } from "./build-roadmap";
import { createAdviceFixture } from "@/__tests__/fixtures";

describe("BuildRoadmap", () => {
  const data = createAdviceFixture();

  it("renders Build Roadmap header", () => {
    render(<BuildRoadmap builds={data.buildRoadmap} />);
    expect(screen.getByText("Build Roadmap")).toBeInTheDocument();
  });

  it("renders build titles", () => {
    render(<BuildRoadmap builds={data.buildRoadmap} />);
    expect(screen.getByText("Tested REST API")).toBeInTheDocument();
    expect(screen.getByText("Published CLI Tool")).toBeInTheDocument();
    expect(screen.getByText("Real-Time Dashboard")).toBeInTheDocument();
  });

  it("renders difficulty badges", () => {
    render(<BuildRoadmap builds={data.buildRoadmap} />);
    expect(screen.getByText("Intermediate")).toBeInTheDocument();
    expect(screen.getByText("Beginner")).toBeInTheDocument();
    expect(screen.getByText("Advanced")).toBeInTheDocument();
  });

  it("renders tech stack", () => {
    render(<BuildRoadmap builds={data.buildRoadmap} />);
    expect(screen.getByText("Node.js")).toBeInTheDocument();
    expect(screen.getByText("Express")).toBeInTheDocument();
    expect(screen.getByText("Commander")).toBeInTheDocument();
    expect(screen.getByText("WebSocket")).toBeInTheDocument();
  });

  it("renders milestones", () => {
    render(<BuildRoadmap builds={data.buildRoadmap} />);
    expect(screen.getByText("API scaffolding with tests")).toBeInTheDocument();
    expect(screen.getByText("CLI scaffolding")).toBeInTheDocument();
    expect(screen.getByText("Database and API layer")).toBeInTheDocument();
  });

  it("renders evidence text", () => {
    render(<BuildRoadmap builds={data.buildRoadmap} />);
    expect(screen.getByText("cool-project has no tests or CI.")).toBeInTheDocument();
    expect(screen.getByText("No CI/CD or package publishing in repos.")).toBeInTheDocument();
    expect(screen.getByText("No full-stack or real-time projects.")).toBeInTheDocument();
  });
});
