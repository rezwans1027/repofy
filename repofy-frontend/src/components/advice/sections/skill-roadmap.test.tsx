import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SkillRoadmap } from "./skill-roadmap";
import { createAdviceFixture } from "@/__tests__/fixtures";

describe("SkillRoadmap", () => {
  const data = createAdviceFixture();

  it("renders Skill Roadmap header", () => {
    render(<SkillRoadmap skills={data.skillRoadmap} />);
    expect(screen.getByText("Skill Roadmap")).toBeInTheDocument();
  });

  it("renders skill names", () => {
    render(<SkillRoadmap skills={data.skillRoadmap} />);
    expect(screen.getByText("Docker")).toBeInTheDocument();
    expect(screen.getByText("GraphQL")).toBeInTheDocument();
  });

  it("renders priority and demand badges", () => {
    render(<SkillRoadmap skills={data.skillRoadmap} />);
    expect(screen.getByText("Now")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
    expect(screen.getByText("Growing")).toBeInTheDocument();
  });

  it("renders reason text", () => {
    render(<SkillRoadmap skills={data.skillRoadmap} />);
    expect(screen.getByText("Essential for modern deployment.")).toBeInTheDocument();
    expect(screen.getByText("Growing API paradigm.")).toBeInTheDocument();
  });

  it("shows empty state when array is empty", () => {
    render(<SkillRoadmap skills={[]} />);
    expect(screen.getByText("Skill Roadmap")).toBeInTheDocument();
    expect(screen.getByText("No skill suggestions available — your stack already covers the key areas.")).toBeInTheDocument();
  });
});
