import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SkillsToLearn } from "./skills-to-learn";
import { createAdviceFixture } from "@/__tests__/fixtures";

describe("SkillsToLearn", () => {
  const data = createAdviceFixture();

  it("renders Skills to Learn header", () => {
    render(<SkillsToLearn skills={data.skillsToLearn} />);
    expect(screen.getByText("Skills to Learn")).toBeInTheDocument();
  });

  it("renders skill names", () => {
    render(<SkillsToLearn skills={data.skillsToLearn} />);
    expect(screen.getByText("Kubernetes")).toBeInTheDocument();
  });

  it("renders demand badges", () => {
    render(<SkillsToLearn skills={data.skillsToLearn} />);
    expect(screen.getByText(/High\s*Demand/)).toBeInTheDocument();
  });

  it("renders reasons", () => {
    render(<SkillsToLearn skills={data.skillsToLearn} />);
    expect(screen.getByText("Essential for modern deployment workflows.")).toBeInTheDocument();
  });

  it("renders Related to text", () => {
    render(<SkillsToLearn skills={data.skillsToLearn} />);
    expect(screen.getByText(/your DevOps experience/)).toBeInTheDocument();
  });
});
