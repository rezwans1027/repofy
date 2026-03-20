import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecentActivity } from "./recent-activity";

describe("RecentActivity", () => {
  const activityBreakdown = {
    pushEvents: 25,
    prEvents: 10,
    issueEvents: 5,
    reviewEvents: 8,
  };

  it("renders 'Recent Activity' header", () => {
    render(<RecentActivity activityBreakdown={activityBreakdown} />);
    expect(screen.getByText("Recent Activity")).toBeInTheDocument();
  });

  it("renders all 4 activity labels", () => {
    render(<RecentActivity activityBreakdown={activityBreakdown} />);
    expect(screen.getByText("Pushes")).toBeInTheDocument();
    expect(screen.getByText("PRs Opened")).toBeInTheDocument();
    expect(screen.getByText("Issues")).toBeInTheDocument();
    expect(screen.getByText("Reviews")).toBeInTheDocument();
  });
});
