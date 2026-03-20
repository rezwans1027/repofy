import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TopCollaborators } from "./top-collaborators";

describe("TopCollaborators", () => {
  const collaborators = [
    { username: "alice", initials: "AL", contributions: 42 },
    { username: "bob", initials: "BO", contributions: 18 },
  ];

  it("renders 'Top Collaborators' header", () => {
    render(<TopCollaborators collaborators={collaborators} />);
    expect(screen.getByText("Top Collaborators")).toBeInTheDocument();
  });

  it("renders collaborator usernames with @", () => {
    render(<TopCollaborators collaborators={collaborators} />);
    expect(screen.getByText("@alice")).toBeInTheDocument();
    expect(screen.getByText("@bob")).toBeInTheDocument();
  });

  it("renders contribution counts", () => {
    render(<TopCollaborators collaborators={collaborators} />);
    expect(screen.getByText("42 contributions")).toBeInTheDocument();
    expect(screen.getByText("18 contributions")).toBeInTheDocument();
  });

  it("renders collaborator initials", () => {
    render(<TopCollaborators collaborators={collaborators} />);
    expect(screen.getByText("AL")).toBeInTheDocument();
    expect(screen.getByText("BO")).toBeInTheDocument();
  });
});
