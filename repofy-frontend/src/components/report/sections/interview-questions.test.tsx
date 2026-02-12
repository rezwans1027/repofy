import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { InterviewQuestions } from "./interview-questions";
import { createReportFixture } from "@/__tests__/fixtures";

describe("InterviewQuestions", () => {
  const data = createReportFixture();

  it("renders Suggested Interview Questions header", () => {
    render(<InterviewQuestions questions={data.interviewQuestions} />);
    expect(screen.getByText("Suggested Interview Questions")).toBeInTheDocument();
  });

  it("renders question with numbering", () => {
    render(<InterviewQuestions questions={data.interviewQuestions} />);
    expect(screen.getByText("1.")).toBeInTheDocument();
    expect(screen.getByText("Describe your testing approach.")).toBeInTheDocument();
  });

  it("renders why text in parentheses", () => {
    render(<InterviewQuestions questions={data.interviewQuestions} />);
    expect(screen.getByText("(Tests testing philosophy)")).toBeInTheDocument();
  });
});
