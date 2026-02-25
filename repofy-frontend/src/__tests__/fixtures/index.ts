export function createReportFixture(overrides: Record<string, unknown> = {}) {
  return {
    candidateLevel: "Senior" as const,
    overallScore: 82,
    recommendation: "Strong Hire" as const,
    narrativeReport: "A strong engineer with excellent code quality. Scores 82/100 at the Senior level with a recommendation of \"Strong Hire\".",
    radarAxes: [
      { axis: "Code Quality", value: 0.87 },
      { axis: "Project Complexity", value: 0.78 },
      { axis: "Technical Breadth", value: 0.82 },
      { axis: "Eng. Practices", value: 0.74 },
      { axis: "Consistency", value: 0.91 },
      { axis: "Collaboration", value: 0.68 },
    ],
    radarBreakdown: [
      { label: "Code Quality", score: 9, note: "Clean code" },
      { label: "Project Complexity", score: 8, note: "Non-trivial systems" },
      { label: "Technical Breadth", score: 8, note: "Multi-language" },
      { label: "Eng. Practices", score: 7, note: "Good CI/CD" },
      { label: "Consistency", score: 9, note: "Regular commits" },
      { label: "Collaboration", score: 7, note: "Some PR reviews" },
    ],
    stats: {
      repos: 47,
      stars: 2340,
      followers: 891,
      contributions: 1847,
      starsPerRepo: 49.8,
      collaborationRatio: 0.34,
      interpretation: "High star count relative to repo count.",
    },
    activityBreakdown: {
      push: 52,
      pr: 24,
      issue: 12,
      review: 12,
      interpretation: "Primarily a builder.",
    },
    languageProfile: {
      languages: [
        { name: "TypeScript", color: "#3178C6", percentage: 38, repos: 18 },
        { name: "Rust", color: "#DEA584", percentage: 27, repos: 12 },
      ],
      interpretation: "TypeScript and Rust dominate.",
    },
    topRepos: [
      {
        name: "test-repo",
        description: "A test repository",
        language: "TypeScript",
        languageColor: "#3178C6",
        stars: 100,
        forks: 10,
        topics: ["typescript"],
        codeQuality: "Excellent" as const,
        testing: "Strong" as const,
        cicd: "Present" as const,
        verdict: "Standout" as const,
        isBestWork: true,
      },
    ],
    strengths: [
      { text: "Consistent commits", evidence: "1847 contributions" },
    ],
    weaknesses: [
      { text: "Testing varies", evidence: "45-78% coverage" },
    ],
    redFlags: [
      { text: "Outdated dependencies", severity: "Minor" as const, explanation: "Common in personal projects." },
    ],
    interviewQuestions: [
      { question: "Describe your testing approach.", why: "Tests testing philosophy" },
    ],
    riskSignals: { concerningCount: 0, notableCount: 0 },
    confidenceScore: 0.95,
    rubricVersion: "v1.1",
    modelVersion: "gpt-5.1",
    dataQualityWarnings: [] as string[],
    ...overrides,
  };
}

export function createReportListItemFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "report-1",
    analyzed_username: "testuser",
    analyzed_name: "Test User",
    overall_score: 82,
    recommendation: "Strong Hire",
    generated_at: "2025-01-15T10:00:00Z",
    ...overrides,
  };
}

export function createSearchResultFixture(overrides: Record<string, unknown> = {}) {
  return {
    username: "testuser",
    name: "Test User",
    avatarUrl: "https://example.com/avatar.jpg",
    bio: "A developer",
    location: "San Francisco",
    company: "TestCorp",
    repos: 42,
    followers: 100,
    ...overrides,
  };
}

export function createProfileFixture(overrides: Record<string, unknown> = {}) {
  return {
    profile: {
      name: "Test User",
      avatarUrl: "https://example.com/avatar.jpg",
      bio: "A developer",
      location: "San Francisco",
      company: "TestCorp",
      publicRepos: 42,
      followers: 100,
      createdAt: "2020-01-01T00:00:00Z",
    },
    stats: { totalStars: 500 },
    contributions: {
      totalContributions: 1200,
      heatmap: [[0, 1, 2]],
    },
    activity: {
      totalEvents: 100,
      pushEvents: 50,
      prEvents: 25,
      issueEvents: 15,
      reviewEvents: 10,
    },
    languages: [
      { name: "TypeScript", color: "#3178C6", percentage: 60, repoCount: 10 },
    ],
    topRepositories: [
      {
        name: "test-repo",
        description: "Test",
        language: "TypeScript",
        stars: 100,
        forks: 10,
        pushedAt: "2025-01-01T00:00:00Z",
        topics: ["typescript"],
        url: "https://github.com/testuser/test-repo",
      },
    ],
    ...overrides,
  };
}

export function createAdviceFixture(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: "v2" as const,
    generationWarnings: [] as string[],
    summary: "Focus on testing and open-source contributions to strengthen your profile.",
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
        difficulty: "Intermediate" as const,
        estimatedWeeks: 4,
        techStack: ["Node.js", "Express", "Vitest", "Supertest", "GitHub Actions", "Docker"],
        milestones: ["API scaffolding with tests", "Integration tests", "CI pipeline", "Docker deployment"],
        hiringSignals: ["Test coverage badge", "Green CI pipeline"],
        evidence: "cool-project has no tests or CI.",
      },
      {
        title: "Published CLI Tool",
        projectOutcome: "An npm-published CLI with automated releases.",
        difficulty: "Beginner" as const,
        estimatedWeeks: 3,
        techStack: ["TypeScript", "Commander", "GitHub Actions", "npm"],
        milestones: ["CLI scaffolding", "Unit tests and CI", "Automated npm publish"],
        hiringSignals: ["Published npm package", "Automated release workflow"],
        evidence: "No CI/CD or package publishing in repos.",
      },
      {
        title: "Real-Time Dashboard",
        projectOutcome: "A full-stack dashboard with WebSocket updates.",
        difficulty: "Advanced" as const,
        estimatedWeeks: 5,
        techStack: ["React", "WebSocket", "PostgreSQL", "Prisma"],
        milestones: ["Database and API layer", "WebSocket integration", "Frontend dashboard", "E2E tests", "Deployment"],
        hiringSignals: ["Live deployed URL", "Full-stack architecture"],
        evidence: "No full-stack or real-time projects.",
      },
    ],
    skillRoadmap: [
      {
        skill: "Docker",
        priority: "Now" as const,
        demandLevel: "High" as const,
        relatedTo: "Node.js",
        reason: "Essential for modern deployment.",
        proofOfLearning: "Add Dockerfile to Build #1.",
        evidence: "No Dockerfiles found.",
      },
      {
        skill: "GraphQL",
        priority: "Next" as const,
        demandLevel: "Growing" as const,
        relatedTo: "REST APIs",
        reason: "Growing API paradigm.",
        proofOfLearning: "Add GraphQL endpoint to dashboard build.",
        evidence: "All repos use REST only.",
      },
    ],
    repoImprovements: [
      {
        repoName: "test-repo",
        repoUrl: "https://github.com/testuser/test-repo",
        language: "TypeScript",
        languageColor: "#3178C6",
        stars: 100,
        improvements: [
          {
            area: "Testing" as const,
            suggestion: "Add integration tests for API routes.",
            priority: "High" as const,
            expectedOutcome: "Test coverage badge and confidence in refactoring.",
          },
          {
            area: "Documentation" as const,
            suggestion: "Add API documentation with examples.",
            priority: "Medium" as const,
            expectedOutcome: "Recruiters can understand the project in 30 seconds.",
          },
        ],
      },
    ],
    contributionStrategy: [
      {
        title: "Contribute to popular OSS",
        detail: "Start with documentation fixes to build reputation.",
        evidence: "No external contributions visible on profile.",
      },
    ],
    profileOptimizations: [
      {
        area: "Bio",
        current: "Developer",
        suggestion: "Senior Full-Stack Engineer | TypeScript & Rust",
        example: "Full-stack TS engineer building tested, production-grade APIs.",
        impact: "First impression for recruiters.",
      },
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
        focus: `Week ${week} focus`,
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

export function createReportListItemSet() {
  return [
    createReportListItemFixture({
      id: "r1",
      analyzed_username: "alice",
      analyzed_name: "Alice Dev",
      overall_score: 92,
      recommendation: "Strong Hire",
      generated_at: "2025-01-16T10:00:00Z",
    }),
    createReportListItemFixture({
      id: "r2",
      analyzed_username: "bob",
      analyzed_name: "Bob Coder",
      overall_score: 71,
      recommendation: "Hire",
      generated_at: "2025-01-15T10:00:00Z",
    }),
    createReportListItemFixture({
      id: "r3",
      analyzed_username: "charlie",
      analyzed_name: "Charlie Eng",
      overall_score: 55,
      recommendation: "Weak Hire",
      generated_at: "2025-01-14T10:00:00Z",
    }),
    createReportListItemFixture({
      id: "r4",
      analyzed_username: "diana",
      analyzed_name: null,
      overall_score: 38,
      recommendation: "No Hire",
      generated_at: "2025-01-12T10:00:00Z",
    }),
    createReportListItemFixture({
      id: "r5",
      analyzed_username: "eve",
      analyzed_name: "Eve Builder",
      overall_score: 80,
      recommendation: "Strong Hire",
      generated_at: "2025-01-13T10:00:00Z",
    }),
  ];
}

export function createAdviceListItemFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "advice-1",
    analyzed_username: "testuser",
    analyzed_name: "Test User",
    generated_at: "2025-01-15T10:00:00Z",
    ...overrides,
  };
}

export function createAdviceListItemSet() {
  return [
    createAdviceListItemFixture({
      id: "a1",
      analyzed_username: "alice",
      analyzed_name: "Alice Dev",
      generated_at: "2025-01-15T10:00:00Z",
    }),
    createAdviceListItemFixture({
      id: "a2",
      analyzed_username: "bob",
      analyzed_name: "Bob Coder",
      generated_at: "2025-01-14T10:00:00Z",
    }),
    createAdviceListItemFixture({
      id: "a3",
      analyzed_username: "charlie",
      analyzed_name: "Charlie Eng",
      generated_at: "2025-01-13T10:00:00Z",
    }),
  ];
}

export function createUserFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-123",
    email: "test@example.com",
    app_metadata: {},
    user_metadata: { name: "Test User" },
    aud: "authenticated",
    created_at: "2020-01-01T00:00:00Z",
    ...overrides,
  };
}
