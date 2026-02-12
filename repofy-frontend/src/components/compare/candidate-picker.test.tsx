import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CandidatePicker } from "./candidate-picker";
import { createReportListItemFixture } from "@/__tests__/fixtures";

describe("CandidatePicker", () => {
  const reports = [
    createReportListItemFixture(),
    createReportListItemFixture({ id: "report-2", analyzed_username: "alice", overall_score: 75, recommendation: "Hire" }),
  ];

  it("renders Candidate label", () => {
    render(
      <CandidatePicker reports={reports} value="" onValueChange={vi.fn()} slot="A" />
    );
    expect(screen.getByText("Candidate A")).toBeInTheDocument();
  });

  it("renders placeholder when no value selected", () => {
    render(
      <CandidatePicker reports={reports} value="" onValueChange={vi.fn()} slot="A" placeholder="Pick one" />
    );
    expect(screen.getByText("Pick one")).toBeInTheDocument();
  });

  it("renders combobox role", () => {
    render(
      <CandidatePicker reports={reports} value="" onValueChange={vi.fn()} slot="B" />
    );
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("shows selected candidate display when value is set", () => {
    render(
      <CandidatePicker reports={reports} value="report-1" onValueChange={vi.fn()} slot="A" />
    );
    expect(screen.getByText("@testuser")).toBeInTheDocument();
  });
});
