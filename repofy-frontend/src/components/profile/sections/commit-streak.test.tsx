import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommitStreak } from "./commit-streak";

describe("CommitStreak", () => {
  const commitStreak = { current: 12, longest: 45 };

  it("renders 'Commit Streak' header", () => {
    render(<CommitStreak commitStreak={commitStreak} />);
    expect(screen.getByText("Commit Streak")).toBeInTheDocument();
  });

  it("renders 'Current Streak' and 'Longest Streak' labels", () => {
    render(<CommitStreak commitStreak={commitStreak} />);
    expect(screen.getByText("Current Streak")).toBeInTheDocument();
    expect(screen.getByText("Longest Streak")).toBeInTheDocument();
  });

  it("renders 'days' text for both streaks", () => {
    render(<CommitStreak commitStreak={commitStreak} />);
    const daysElements = screen.getAllByText("days");
    expect(daysElements).toHaveLength(2);
  });
});
