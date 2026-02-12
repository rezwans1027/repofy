import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdviceReport } from "./advice-report";
import { createAdviceFixture } from "@/__tests__/fixtures";

vi.mock("@/lib/export-pdf", () => ({
  exportToPdf: vi.fn().mockResolvedValue(undefined),
}));

describe("AdviceReport", () => {
  const data = createAdviceFixture();

  it("renders the username in the banner", () => {
    render(<AdviceReport username="testuser" data={data} />);
    const matches = screen.getAllByText("@testuser");
    expect(matches).toHaveLength(2);
  });

  it("renders the summary text", () => {
    render(<AdviceReport username="testuser" data={data} />);
    expect(screen.getByText(data.summary)).toBeInTheDocument();
  });

  it("renders project ideas", () => {
    render(<AdviceReport username="testuser" data={data} />);
    expect(screen.getByText("Real-time Chat App")).toBeInTheDocument();
  });

  it("renders skills to learn", () => {
    render(<AdviceReport username="testuser" data={data} />);
    expect(screen.getByText("Kubernetes")).toBeInTheDocument();
  });

  it("renders action plan timeframes", () => {
    render(<AdviceReport username="testuser" data={data} />);
    expect(screen.getByText("30 days")).toBeInTheDocument();
    expect(screen.getByText("60 days")).toBeInTheDocument();
    expect(screen.getByText("90 days")).toBeInTheDocument();
  });

  it("renders contribution advice", () => {
    render(<AdviceReport username="testuser" data={data} />);
    expect(screen.getByText("Contribute to popular OSS")).toBeInTheDocument();
  });

  it("renders profile optimizations", () => {
    render(<AdviceReport username="testuser" data={data} />);
    expect(screen.getByText("Bio")).toBeInTheDocument();
  });

  it("renders the export bar with username", () => {
    render(<AdviceReport username="testuser" data={data} />);
    // The export bar shows "Advice for @testuser"
    const allTexts = screen.getAllByText("@testuser");
    expect(allTexts).toHaveLength(2); // banner + export bar
  });
});
