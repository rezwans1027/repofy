import type { ScorerResponse, ScoringResult, AIAnalysisResponse, AdviceV2, AdviceV2Raw } from "../../src/types";

export function createScorerResponse(overrides: Partial<ScorerResponse> = {}): ScorerResponse {
  return {
    radarAxes: [
      { axis: "Code Quality", value: 0.7 },
      { axis: "Project Complexity", value: 0.6 },
      { axis: "Technical Breadth", value: 0.65 },
      { axis: "Eng. Practices", value: 0.5 },
      { axis: "Consistency", value: 0.55 },
      { axis: "Collaboration", value: 0.4 },
    ],
    radarBreakdown: [
      { label: "Code Quality", note: "Clean code." },
      { label: "Project Complexity", note: "Moderate complexity." },
      { label: "Technical Breadth", note: "Good range." },
      { label: "Eng. Practices", note: "Some CI but lacking tests." },
      { label: "Consistency", note: "Regular commits." },
      { label: "Collaboration", note: "Limited PR activity." },
    ],
    statsInterpretation: "Moderate GitHub presence.",
    activityInterpretation: "Push-based workflow.",
    languageInterpretation: "JavaScript-heavy with TypeScript.",
    topRepos: [
      {
        name: "cool-project",
        codeQuality: "Good",
        testing: "Some",
        cicd: "None",
        verdict: "Solid",
        isBestWork: true,
      },
    ],
    strengths: [
      { text: "Clean code", evidence: "Consistent naming." },
      { text: "Active contributor", evidence: "Regular commits." },
      { text: "Good variety", evidence: "Multiple project types." },
    ],
    weaknesses: [
      { text: "No tests", evidence: "No test files found." },
      { text: "Minimal docs", evidence: "Bare READMEs." },
      { text: "No CI/CD", evidence: "No workflow files." },
    ],
    redFlags: [
      { text: "No tests", severity: "Notable", explanation: "Lacks testing maturity." },
    ],
    interviewQuestions: [
      { question: "Describe your testing philosophy.", why: "No tests found." },
      { question: "How do you handle code reviews?", why: "Limited PRs." },
      { question: "Walk me through your CI/CD setup.", why: "No CI config." },
      { question: "How do you approach docs?", why: "Minimal READMEs." },
    ],
    dataQualityWarnings: [],
    ...overrides,
  };
}

export function createScoringResult(overrides: Partial<ScoringResult> = {}): ScoringResult {
  return {
    overallScore: 59,
    candidateLevel: "Junior",
    recommendation: "Weak Hire",
    radarBreakdownScores: {
      "Code Quality": 7,
      "Project Complexity": 6,
      "Technical Breadth": 7,
      "Eng. Practices": 5,
      "Consistency": 6,
      "Collaboration": 4,
    },
    riskSignals: { concerningCount: 0, notableCount: 1 },
    confidenceScore: 0.9,
    rubricVersion: "v1.1",
    modelVersion: "gpt-5.1",
    ...overrides,
  };
}

/** @deprecated Use createScorerResponse instead */
export function createAIAnalysisResponse(overrides: Partial<AIAnalysisResponse> = {}): AIAnalysisResponse {
  return {
    candidateLevel: "Junior",
    overallScore: 59,
    recommendation: "Weak Hire",
    summary: "Solid developer with good fundamentals.",
    radarAxes: [
      { axis: "Code Quality", value: 0.7 },
      { axis: "Project Complexity", value: 0.6 },
      { axis: "Technical Breadth", value: 0.65 },
      { axis: "Eng. Practices", value: 0.5 },
      { axis: "Consistency", value: 0.55 },
      { axis: "Collaboration", value: 0.4 },
    ],
    radarBreakdown: [
      { label: "Code Quality", score: 7, note: "Clean code." },
      { label: "Project Complexity", score: 6, note: "Moderate complexity." },
      { label: "Technical Breadth", score: 6.5, note: "Good range." },
      { label: "Eng. Practices", score: 5, note: "Some CI but lacking tests." },
      { label: "Consistency", score: 5.5, note: "Regular commits." },
      { label: "Collaboration", score: 4, note: "Limited PR activity." },
    ],
    statsInterpretation: "Moderate GitHub presence.",
    activityInterpretation: "Push-based workflow.",
    languageInterpretation: "JavaScript-heavy with TypeScript.",
    topRepos: [
      {
        name: "cool-project",
        codeQuality: "B+",
        testing: "C",
        cicd: "C",
        verdict: "Good project.",
        isBestWork: true,
      },
    ],
    strengths: [
      { text: "Clean code", evidence: "Consistent naming." },
      { text: "Active contributor", evidence: "Regular commits." },
      { text: "Good variety", evidence: "Multiple project types." },
    ],
    weaknesses: [
      { text: "No tests", evidence: "No test files found." },
      { text: "Minimal docs", evidence: "Bare READMEs." },
      { text: "No CI/CD", evidence: "No workflow files." },
    ],
    redFlags: [
      { text: "No tests", severity: "Notable", explanation: "Lacks testing maturity." },
    ],
    interviewQuestions: [
      { question: "Describe your testing philosophy.", why: "No tests found." },
      { question: "How do you handle code reviews?", why: "Limited PRs." },
      { question: "Walk me through your CI/CD setup.", why: "No CI config." },
      { question: "How do you approach docs?", why: "Minimal READMEs." },
    ],
    ...overrides,
  };
}

export function createShuffledRadarResponse(): ScorerResponse {
  return createScorerResponse({
    radarAxes: [
      { axis: "Collaboration", value: 0.4 },
      { axis: "Code Quality", value: 0.7 },
      { axis: "Consistency", value: 0.55 },
      { axis: "Technical Breadth", value: 0.65 },
      { axis: "Project Complexity", value: 0.6 },
      { axis: "Eng. Practices", value: 0.5 },
    ],
    radarBreakdown: [
      { label: "Collaboration", note: "Limited." },
      { label: "Code Quality", note: "Clean." },
      { label: "Consistency", note: "Regular." },
      { label: "Technical Breadth", note: "Good range." },
      { label: "Project Complexity", note: "Moderate." },
      { label: "Eng. Practices", note: "Some CI." },
    ],
  });
}

export function createAdviceV2Raw(overrides: Partial<AdviceV2Raw> = {}): AdviceV2Raw {
  return {
    summary: "Focus on testing and documentation.",
    trajectory: {
      currentEstimate: "Junior",
      targetEstimate: "Mid-Level",
      confidence: "Medium",
      rationale: "Repos show clean fundamentals but lack tests. Complexity is moderate. Breadth limited to JS ecosystem. Collaboration is single-contributor. Engineering practices are weak with no CI. Consistency is good with recent pushes.",
      calibration: {
        complexity: "Moderate complexity projects.",
        breadth: "TypeScript and JavaScript only.",
        collaboration: "Single-contributor repos.",
        engineeringPractices: "No tests or CI detected.",
        consistency: "Active pushes within 60 days.",
      },
    },
    buildRoadmap: [
      {
        title: "Tested REST API",
        projectOutcome: "A production-grade REST API with full test suite.",
        difficulty: "Intermediate",
        estimatedWeeks: 4,
        techStack: ["Node.js", "Express", "Vitest", "Supertest", "GitHub Actions", "Docker"],
        milestones: ["API scaffolding with tests", "Integration tests", "CI pipeline", "Docker deployment"],
        hiringSignals: ["Test coverage badge", "Green CI pipeline"],
        evidence: "cool-project has no tests or CI.",
      },
      {
        title: "Published CLI Tool",
        projectOutcome: "An npm-published CLI with automated releases.",
        difficulty: "Beginner",
        estimatedWeeks: 3,
        techStack: ["TypeScript", "Commander", "GitHub Actions", "npm", "Changesets", "Vitest"],
        milestones: ["CLI scaffolding", "Unit tests and CI", "Automated npm publish"],
        hiringSignals: ["Published npm package", "Automated release workflow"],
        evidence: "No CI/CD or package publishing in current repos.",
      },
      {
        title: "Real-Time Dashboard",
        projectOutcome: "A full-stack dashboard with WebSocket updates.",
        difficulty: "Advanced",
        estimatedWeeks: 5,
        techStack: ["React", "WebSocket", "PostgreSQL", "Prisma", "Tailwind CSS", "Vitest"],
        milestones: ["Database and API layer", "WebSocket integration", "Frontend dashboard", "E2E tests", "Deployment"],
        hiringSignals: ["Live deployed URL", "Full-stack architecture"],
        evidence: "No full-stack or real-time projects in profile.",
      },
    ],
    skillRoadmap: [
      {
        skill: "Docker",
        priority: "Now",
        demandLevel: "High",
        relatedTo: "Node.js",
        reason: "Essential for modern deployment.",
        proofOfLearning: "Add Dockerfile to Build #1.",
        evidence: "No Dockerfiles found.",
      },
      {
        skill: "GraphQL",
        priority: "Next",
        demandLevel: "Growing",
        relatedTo: "REST APIs",
        reason: "Growing API paradigm.",
        proofOfLearning: "Add GraphQL endpoint to dashboard build.",
        evidence: "All repos use REST only.",
      },
      {
        skill: "Kubernetes",
        priority: "Later",
        demandLevel: "High",
        relatedTo: "Docker",
        reason: "Container orchestration for production.",
        proofOfLearning: "Deploy one build to k8s.",
        evidence: "No orchestration experience.",
      },
      {
        skill: "Redis",
        priority: "Next",
        demandLevel: "High",
        relatedTo: "Node.js",
        reason: "Caching for production APIs.",
        proofOfLearning: "Add Redis caching to REST API build.",
        evidence: "No caching in repos.",
      },
    ],
    repoImprovements: [
      {
        repoName: "cool-project",
        improvements: [
          { area: "Testing", suggestion: "Add unit tests.", priority: "High", expectedOutcome: "Test coverage badge." },
          { area: "CI/CD", suggestion: "Add GitHub Actions.", priority: "High", expectedOutcome: "Green CI badge." },
        ],
      },
    ],
    contributionStrategy: [
      { title: "Use conventional commits", detail: "Improves readability.", evidence: "Current commits use generic messages." },
      { title: "Contribute to OSS", detail: "Start with docs PRs.", evidence: "No external contributions." },
      { title: "Review others' PRs", detail: "Build collaboration evidence.", evidence: "No review activity." },
    ],
    profileOptimizations: [
      { area: "Bio", current: "Missing", suggestion: "Add a focused bio.", example: "Full-stack TS engineer.", impact: "First impression for recruiters." },
      { area: "Pinned Repos", current: "Default", suggestion: "Pin best 3 repos.", example: "Pin cool-project and builds.", impact: "Curated portfolio view." },
      { area: "Profile README", current: "Missing", suggestion: "Create a README profile.", example: "Add tech badges.", impact: "Stands out from default profiles." },
      { area: "Repo Descriptions", current: "Generic", suggestion: "Add one-line descriptions.", example: "'TypeScript REST API with test suite'", impact: "Appears in search results." },
    ],
    weeklyRoadmap: Array.from({ length: 12 }, (_, i) => {
      const week = i + 1;
      let activeBuildTitle: string;
      if (week <= 4) activeBuildTitle = "Tested REST API";
      else if (week <= 7) activeBuildTitle = "Published CLI Tool";
      else activeBuildTitle = "Real-Time Dashboard";
      return {
        week,
        activeBuildTitle,
        focus: `Week ${week} focus for ${activeBuildTitle}`,
        deliverable: `Week ${week} deliverable`,
        tasks: [`Task A for week ${week}`, `Task B for week ${week}`],
        skillTask: `Skill learning for week ${week}`,
        successCheck: `Week ${week} checkpoint`,
      };
    }),
    successMetrics: [
      "Reach 3+ merged PRs to OSS repos outside personal projects within 12 weeks.",
      "Deploy all 3 portfolio builds with public URLs by week 12.",
      "Publish the CLI tool to npm with automated release pipeline by week 7.",
      "Achieve 80%+ test coverage on the REST API build by week 4.",
      "Maintain weekly commit streak for 12 consecutive weeks.",
    ],
    ...overrides,
  };
}

export function createAdviceV2Response(overrides: Partial<AdviceV2> = {}): AdviceV2 {
  const raw = createAdviceV2Raw();
  return {
    schemaVersion: "v2",
    generationWarnings: [],
    ...raw,
    ...overrides,
  };
}
