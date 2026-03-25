import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdviceReportPdfLayout } from "@/components/advice/advice-pdf-layout";
import type { AdviceData } from "@shared/types/advice";

// ── Fixture ──────────────────────────────────────────────────────────

function makeAdviceData(overrides?: Partial<AdviceData>): AdviceData {
  return {
    schemaVersion: "v2",
    generationWarnings: [],
    summary: "A strong full-stack profile with room to grow in testing.",
    trajectory: {
      currentEstimate: "Mid-Level",
      targetEstimate: "Senior",
      confidence: "High",
      rationale: "Consistent contributions across multiple repos.",
      calibration: {
        complexity: "Handles moderately complex systems",
        breadth: "3 languages, 2 frameworks",
        collaboration: "Active PR reviewer",
        engineeringPractices: "CI/CD in most repos",
        consistency: "Weekly commits for 6 months",
      },
    },
    buildRoadmap: [
      {
        title: "Real-Time Dashboard",
        projectOutcome: "Showcase WebSocket and data viz skills",
        difficulty: "Intermediate",
        estimatedWeeks: 4,
        techStack: ["React", "D3", "WebSocket"],
        milestones: ["Setup repo", "Build WS layer", "Add charts"],
        hiringSignals: ["Real-time architecture", "Data visualization"],
        evidence: "No real-time projects found in profile",
      },
    ],
    skillRoadmap: [
      {
        skill: "Kubernetes",
        priority: "Now",
        demandLevel: "High",
        relatedTo: "Docker experience",
        reason: "Natural next step from containerisation",
        proofOfLearning: "Deploy a multi-service app on k8s",
        evidence: "Docker used in 3 repos",
      },
    ],
    repoImprovements: [
      {
        repoName: "my-app",
        language: "TypeScript",
        stars: 12,
        improvements: [
          {
            area: "Testing",
            suggestion: "Add integration tests",
            priority: "High",
            expectedOutcome: "Catch regressions before deploy",
          },
        ],
      },
    ],
    contributionStrategy: [
      {
        title: "Contribute to popular OSS",
        detail: "Target mid-size projects in your stack",
        evidence: "No OSS contributions found",
      },
    ],
    profileOptimizations: [
      {
        area: "Bio",
        current: "Empty bio",
        suggestion: "Add a one-liner about your focus",
        example: "Full-stack engineer focused on React & Node",
        impact: "Improves recruiter first impressions",
      },
    ],
    weeklyRoadmap: [
      {
        week: 1,
        activeBuildTitle: "Real-Time Dashboard",
        focus: "Project scaffolding",
        deliverable: "Boilerplate with CI",
        tasks: ["Init repo", "Add CI pipeline"],
        skillTask: "Read k8s intro docs",
        successCheck: "CI passes on push",
      },
    ],
    strengthsAndGaps: {
      strengths: [
        { area: "Frontend", detail: "Strong React & TypeScript usage" },
      ],
      gaps: [
        { area: "Testing", detail: "Very few test files across repos" },
      ],
    },
    careerPositioning: {
      positioning: "Position as a product-minded full-stack engineer.",
      roles: ["Senior Frontend Engineer", "Full-Stack Engineer"],
      differentiators: ["Strong UI craft", "CI/CD proficiency"],
    },
    successMetrics: [
      "Ship 2 portfolio projects within 12 weeks",
      "Get 3 OSS PRs merged",
    ],
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("AdviceReportPdfLayout", () => {
  const username = "testuser";

  it("renders the header with username", () => {
    render(<AdviceReportPdfLayout username={username} data={makeAdviceData()} />);
    expect(screen.getByText("Career Advice Report")).toBeInTheDocument();
    expect(screen.getByText("@testuser")).toBeInTheDocument();
  });

  it("renders the data-pdf-sections attribute for export targeting", () => {
    const { container } = render(
      <AdviceReportPdfLayout username={username} data={makeAdviceData()} />,
    );
    expect(container.querySelector("[data-pdf-sections]")).toBeInTheDocument();
  });

  it("renders the summary section", () => {
    render(<AdviceReportPdfLayout username={username} data={makeAdviceData()} />);
    expect(
      screen.getByText("A strong full-stack profile with room to grow in testing."),
    ).toBeInTheDocument();
  });

  // ── Career Trajectory ──────────────────────────────────────────────

  it("renders career trajectory with level estimates", () => {
    render(<AdviceReportPdfLayout username={username} data={makeAdviceData()} />);
    expect(screen.getByText("Mid-Level")).toBeInTheDocument();
    expect(screen.getByText("Senior")).toBeInTheDocument();
    expect(screen.getByText("Confidence: High")).toBeInTheDocument();
  });

  it("renders trajectory calibration entries with camelCase → spaced labels", () => {
    render(<AdviceReportPdfLayout username={username} data={makeAdviceData()} />);
    expect(screen.getByText("engineering Practices")).toBeInTheDocument();
    expect(screen.getByText("Handles moderately complex systems")).toBeInTheDocument();
  });

  it("renders trajectory rationale", () => {
    render(<AdviceReportPdfLayout username={username} data={makeAdviceData()} />);
    expect(
      screen.getByText("Consistent contributions across multiple repos."),
    ).toBeInTheDocument();
  });

  // ── Strengths & Gaps ──────────────────────────────────────────────

  it("renders strengths and gaps", () => {
    render(<AdviceReportPdfLayout username={username} data={makeAdviceData()} />);
    expect(screen.getByText("Frontend")).toBeInTheDocument();
    expect(screen.getByText("Strong React & TypeScript usage")).toBeInTheDocument();
    expect(screen.getByText("Very few test files across repos")).toBeInTheDocument();
  });

  // ── Career Positioning ────────────────────────────────────────────

  it("renders career positioning with roles and differentiators", () => {
    render(<AdviceReportPdfLayout username={username} data={makeAdviceData()} />);
    expect(
      screen.getByText("Position as a product-minded full-stack engineer."),
    ).toBeInTheDocument();
    expect(screen.getByText("Senior Frontend Engineer")).toBeInTheDocument();
    expect(screen.getByText("Strong UI craft")).toBeInTheDocument();
  });

  // ── Build Roadmap ─────────────────────────────────────────────────

  it("renders build roadmap with project details", () => {
    render(<AdviceReportPdfLayout username={username} data={makeAdviceData()} />);
    // Title appears twice: build roadmap + weekly roadmap activeBuildTitle
    expect(screen.getAllByText("Real-Time Dashboard")).toHaveLength(2);
    expect(
      screen.getByText("Showcase WebSocket and data viz skills"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Intermediate · ~4 weeks/)).toBeInTheDocument();
  });

  it("renders build roadmap tech stack", () => {
    render(<AdviceReportPdfLayout username={username} data={makeAdviceData()} />);
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("D3")).toBeInTheDocument();
    expect(screen.getByText("WebSocket")).toBeInTheDocument();
  });

  it("renders build roadmap milestones with numbering", () => {
    render(<AdviceReportPdfLayout username={username} data={makeAdviceData()} />);
    expect(screen.getByText("Setup repo")).toBeInTheDocument();
    expect(screen.getByText("Build WS layer")).toBeInTheDocument();
    expect(screen.getByText("Add charts")).toBeInTheDocument();
  });

  it("renders hiring signals when present", () => {
    render(<AdviceReportPdfLayout username={username} data={makeAdviceData()} />);
    expect(screen.getByText("Real-time architecture")).toBeInTheDocument();
    expect(screen.getByText("Data visualization")).toBeInTheDocument();
  });

  it("hides hiring signals section when empty", () => {
    const data = makeAdviceData({
      buildRoadmap: [
        {
          title: "Project X",
          projectOutcome: "Outcome",
          difficulty: "Beginner",
          estimatedWeeks: 2,
          techStack: ["Go"],
          milestones: ["Start"],
          hiringSignals: [],
          evidence: "None",
        },
      ],
    });
    render(<AdviceReportPdfLayout username={username} data={data} />);
    // The "Hiring Signals" label should not appear for empty arrays
    const headings = screen.queryAllByText("Hiring Signals");
    expect(headings).toHaveLength(0);
  });

  // ── Weekly Roadmap ────────────────────────────────────────────────

  it("renders weekly roadmap entries", () => {
    render(<AdviceReportPdfLayout username={username} data={makeAdviceData()} />);
    expect(screen.getByText("Week 1")).toBeInTheDocument();
    expect(screen.getByText("Project scaffolding")).toBeInTheDocument();
    expect(screen.getByText("Deliverable: Boilerplate with CI")).toBeInTheDocument();
    expect(screen.getByText(/Skill: Read k8s intro docs/)).toBeInTheDocument();
    expect(screen.getByText(/Check: CI passes on push/)).toBeInTheDocument();
  });

  it("hides weekly roadmap section when empty", () => {
    const data = makeAdviceData({ weeklyRoadmap: [] });
    render(<AdviceReportPdfLayout username={username} data={data} />);
    expect(screen.queryByText("Weekly Plan")).not.toBeInTheDocument();
  });

  // ── Success Metrics ───────────────────────────────────────────────

  it("renders success metrics as a list", () => {
    render(<AdviceReportPdfLayout username={username} data={makeAdviceData()} />);
    expect(
      screen.getByText("Ship 2 portfolio projects within 12 weeks"),
    ).toBeInTheDocument();
    expect(screen.getByText("Get 3 OSS PRs merged")).toBeInTheDocument();
  });

  // ── Skill Roadmap ─────────────────────────────────────────────────

  it("renders skill roadmap with priority and demand", () => {
    render(<AdviceReportPdfLayout username={username} data={makeAdviceData()} />);
    expect(screen.getByText("Kubernetes")).toBeInTheDocument();
    expect(screen.getByText(/Now · High demand/)).toBeInTheDocument();
    expect(
      screen.getByText("Natural next step from containerisation"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Proof: Deploy a multi-service app on k8s/),
    ).toBeInTheDocument();
  });

  // ── Repository Improvements ───────────────────────────────────────

  it("renders repo improvements with priority and star count", () => {
    render(<AdviceReportPdfLayout username={username} data={makeAdviceData()} />);
    expect(screen.getByText("my-app")).toBeInTheDocument();
    expect(screen.getByText(/TypeScript · 12 stars/)).toBeInTheDocument();
    expect(screen.getByText("[High]")).toBeInTheDocument();
    expect(screen.getByText(/Add integration tests/)).toBeInTheDocument();
    expect(
      screen.getByText("Catch regressions before deploy"),
    ).toBeInTheDocument();
  });

  it("hides repo improvements section when empty", () => {
    const data = makeAdviceData({ repoImprovements: [] });
    render(<AdviceReportPdfLayout username={username} data={data} />);
    expect(
      screen.queryByText("Repository Improvements"),
    ).not.toBeInTheDocument();
  });

  it("renders repo improvements without stars when undefined", () => {
    const data = makeAdviceData({
      repoImprovements: [
        {
          repoName: "bare-repo",
          language: "Go",
          improvements: [
            {
              area: "Documentation",
              suggestion: "Add a README",
              priority: "Medium",
              expectedOutcome: "Better onboarding",
            },
          ],
        },
      ],
    });
    render(<AdviceReportPdfLayout username={username} data={data} />);
    expect(screen.getByText("bare-repo")).toBeInTheDocument();
    // Should only show language, no stars text
    const langEl = screen.getByText("Go");
    expect(langEl).toBeInTheDocument();
    expect(screen.queryByText(/stars/)).not.toBeInTheDocument();
  });

  // ── Contribution Strategy ─────────────────────────────────────────

  it("renders contribution strategy items", () => {
    render(<AdviceReportPdfLayout username={username} data={makeAdviceData()} />);
    expect(screen.getByText("Contribute to popular OSS")).toBeInTheDocument();
    expect(
      screen.getByText("Target mid-size projects in your stack"),
    ).toBeInTheDocument();
  });

  // ── Profile Optimizations ─────────────────────────────────────────

  it("renders profile optimizations with current/suggested", () => {
    render(<AdviceReportPdfLayout username={username} data={makeAdviceData()} />);
    expect(screen.getByText("Bio")).toBeInTheDocument();
    expect(screen.getByText("Empty bio")).toBeInTheDocument();
    expect(
      screen.getByText("Add a one-liner about your focus"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Impact: Improves recruiter first impressions/),
    ).toBeInTheDocument();
  });

  // ── Section headings completeness ─────────────────────────────────

  it("renders all expected section headings for full data", () => {
    render(<AdviceReportPdfLayout username={username} data={makeAdviceData()} />);
    const expectedHeadings = [
      "Summary",
      "Career Trajectory",
      "Strengths",
      "Gaps",
      "Career Positioning",
      "Build Roadmap",
      "Weekly Plan",
      "Success Metrics",
      "Skill Roadmap",
      "Repository Improvements",
      "Contribution Strategy",
      "Profile Optimizations",
    ];
    for (const heading of expectedHeadings) {
      expect(screen.getByText(heading)).toBeInTheDocument();
    }
  });
});
