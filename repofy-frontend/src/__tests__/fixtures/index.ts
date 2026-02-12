export function createReportFixture(overrides: Record<string, unknown> = {}) {
  return {
    candidateLevel: "Senior" as const,
    overallScore: 82,
    recommendation: "Strong Hire" as const,
    summary: "A strong engineer with excellent code quality.",
    radarAxes: [
      { axis: "Code Quality", value: 0.87 },
      { axis: "Project Complexity", value: 0.78 },
      { axis: "Technical Breadth", value: 0.82 },
      { axis: "Eng. Practices", value: 0.74 },
      { axis: "Consistency", value: 0.91 },
      { axis: "Collaboration", value: 0.68 },
    ],
    radarBreakdown: [
      { label: "Code Quality", score: 8.7, note: "Clean code" },
      { label: "Project Complexity", score: 7.8, note: "Non-trivial systems" },
      { label: "Technical Breadth", score: 8.2, note: "Multi-language" },
      { label: "Engineering Practices", score: 7.4, note: "Good CI/CD" },
      { label: "Consistency", score: 9.1, note: "Regular commits" },
      { label: "Collaboration", score: 6.8, note: "Some PR reviews" },
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
        codeQuality: "A" as const,
        testing: "B+" as const,
        cicd: "A-" as const,
        verdict: "Good project.",
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
    summary: "Focus on testing and open-source contributions to strengthen your profile.",
    projectIdeas: [
      {
        title: "Real-time Chat App",
        description: "Build a scalable chat application with WebSockets.",
        techStack: ["TypeScript", "Node.js", "Redis"],
        difficulty: "Intermediate" as const,
        why: "Demonstrates real-time architecture skills.",
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
          },
          {
            area: "Documentation" as const,
            suggestion: "Add API documentation with examples.",
            priority: "Medium" as const,
          },
        ],
      },
    ],
    skillsToLearn: [
      {
        skill: "Kubernetes",
        reason: "Essential for modern deployment workflows.",
        demandLevel: "High" as const,
        relatedTo: "your DevOps experience",
      },
    ],
    contributionAdvice: [
      { title: "Contribute to popular OSS", detail: "Start with documentation fixes to build reputation." },
    ],
    profileOptimizations: [
      { area: "Bio", current: "Developer", suggestion: "Senior Full-Stack Engineer | TypeScript & Rust" },
    ],
    actionPlan: [
      { timeframe: "30 days" as const, actions: ["Add tests to top 3 repos", "Update GitHub bio"] },
      { timeframe: "60 days" as const, actions: ["Launch side project", "Start blogging"] },
      { timeframe: "90 days" as const, actions: ["Contribute to 2 OSS projects", "Apply to speak at meetup"] },
    ],
    ...overrides,
  };
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
