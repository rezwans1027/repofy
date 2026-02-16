import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  ComparisonSideBySide,
  StrengthsList,
  WeaknessesList,
  RedFlagsList,
  InterviewQuestionsList,
  TopReposList,
} from "./comparison-side-by-side";
import { createReportFixture } from "@/__tests__/fixtures";

describe("ComparisonSideBySide", () => {
  it("renders title", () => {
    render(
      <ComparisonSideBySide
        title="Test Title"
        labelA="alice"
        labelB="bob"
        renderA={() => <div>Content A</div>}
        renderB={() => <div>Content B</div>}
      />
    );
    expect(screen.getByText("Test Title")).toBeInTheDocument();
  });

  it("renders labelA and labelB with @ prefix", () => {
    render(
      <ComparisonSideBySide
        title="Test"
        labelA="alice"
        labelB="bob"
        renderA={() => <div>A</div>}
        renderB={() => <div>B</div>}
      />
    );
    expect(screen.getByText("@alice")).toBeInTheDocument();
    expect(screen.getByText("@bob")).toBeInTheDocument();
  });

  it("calls renderA and renderB", () => {
    const renderA = vi.fn(() => <div>Content A</div>);
    const renderB = vi.fn(() => <div>Content B</div>);
    render(
      <ComparisonSideBySide
        title="Test"
        labelA="alice"
        labelB="bob"
        renderA={renderA}
        renderB={renderB}
      />
    );
    expect(screen.getByText("Content A")).toBeInTheDocument();
    expect(screen.getByText("Content B")).toBeInTheDocument();
  });
});

describe("StrengthsList", () => {
  it("renders strength text and evidence", () => {
    const data = createReportFixture();
    render(<StrengthsList strengths={data.strengths} />);
    expect(screen.getByText("Consistent commits")).toBeInTheDocument();
    expect(screen.getByText("1847 contributions")).toBeInTheDocument();
  });
});

describe("WeaknessesList", () => {
  it("renders weakness text and evidence", () => {
    const data = createReportFixture();
    render(<WeaknessesList weaknesses={data.weaknesses} />);
    expect(screen.getByText("Testing varies")).toBeInTheDocument();
    expect(screen.getByText("45-78% coverage")).toBeInTheDocument();
  });
});

describe("RedFlagsList", () => {
  it("renders red flag text and severity", () => {
    const data = createReportFixture();
    render(<RedFlagsList redFlags={data.redFlags} />);
    expect(screen.getByText("Outdated dependencies")).toBeInTheDocument();
    expect(screen.getByText("Minor")).toBeInTheDocument();
  });
});

describe("InterviewQuestionsList", () => {
  it("renders questions with numbering", () => {
    const data = createReportFixture();
    render(<InterviewQuestionsList questions={data.interviewQuestions} />);
    expect(screen.getByText("1.")).toBeInTheDocument();
    expect(screen.getByText("Describe your testing approach.")).toBeInTheDocument();
  });
});

describe("TopReposList", () => {
  it("renders repo names and badges", () => {
    const data = createReportFixture();
    render(<TopReposList repos={data.topRepos} />);
    expect(screen.getByText("test-repo")).toBeInTheDocument();
    expect(screen.getByText("Best Work")).toBeInTheDocument();
  });
});
