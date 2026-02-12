import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ComparisonActivity } from "./comparison-activity";
import { createReportFixture } from "@/__tests__/fixtures";

describe("ComparisonActivity", () => {
  const reportA = createReportFixture();
  const reportB = createReportFixture();

  it("renders Activity Breakdown header", () => {
    render(<ComparisonActivity reportA={reportA} reportB={reportB} usernameA="alice" usernameB="bob" />);
    expect(screen.getByText("Activity Breakdown")).toBeInTheDocument();
  });

  it("renders both usernames", () => {
    render(<ComparisonActivity reportA={reportA} reportB={reportB} usernameA="alice" usernameB="bob" />);
    expect(screen.getByText("@alice")).toBeInTheDocument();
    expect(screen.getByText("@bob")).toBeInTheDocument();
  });

  it("renders 4 legend labels", () => {
    render(<ComparisonActivity reportA={reportA} reportB={reportB} usernameA="alice" usernameB="bob" />);
    expect(screen.getByText("Push")).toBeInTheDocument();
    expect(screen.getByText("PR")).toBeInTheDocument();
    expect(screen.getByText("Issue")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
  });
});
