import type {
  ScorerResponse,
  ScoringResult,
  AdviceV2,
  GitHubUserData,
  GitHubSearchResult,
  RepoSnapshot,
  AggregateMetrics,
} from "../types";
import { buildReportData } from "./analyze.service";

export const MOCK_SCORER_RESPONSE: ScorerResponse = {
  radarAxes: [
    { axis: "Code Quality", value: 0.7 },
    { axis: "Project Complexity", value: 0.6 },
    { axis: "Technical Breadth", value: 0.65 },
    { axis: "Eng. Practices", value: 0.5 },
    { axis: "Consistency", value: 0.55 },
    { axis: "Collaboration", value: 0.4 },
  ],
  radarBreakdown: [
    { label: "Code Quality", note: "Clean code with consistent style across repos." },
    { label: "Project Complexity", note: "Moderate complexity projects." },
    { label: "Technical Breadth", note: "Good range of technologies." },
    { label: "Eng. Practices", note: "Some CI but lacking tests." },
    { label: "Consistency", note: "Regular commits with some gaps." },
    { label: "Collaboration", note: "Limited PR activity." },
  ],
  statsInterpretation: "Moderate GitHub presence with room for growth.",
  activityInterpretation: "Primarily push-based workflow.",
  languageInterpretation: "JavaScript-heavy with some TypeScript.",
  topRepos: [
    {
      name: "cool-project",
      codeQuality: "Good",
      testing: "Some",
      cicd: "None",
      verdict: "Solid",
      isBestWork: true,
    },
    {
      name: "another-repo",
      codeQuality: "Mixed",
      testing: "None",
      cicd: "None",
      verdict: "Needs Work",
      isBestWork: false,
    },
  ],
  strengths: [
    { text: "Clean code style", evidence: "Consistent naming conventions across repos." },
    { text: "Active contributor", evidence: "Regular commits over the past year." },
    { text: "Good project variety", evidence: "Repos span web, CLI, and API projects." },
  ],
  weaknesses: [
    { text: "Lacking tests", evidence: "No test files found in top repos." },
    { text: "Minimal documentation", evidence: "Most repos have bare-bones READMEs." },
    { text: "No CI/CD", evidence: "No GitHub Actions or CI configuration files." },
  ],
  redFlags: [
    { text: "No test coverage", severity: "Notable", explanation: "Indicates lack of engineering maturity." },
  ],
  interviewQuestions: [
    { question: "Describe your testing philosophy.", why: "No tests found in any repos." },
    { question: "How do you handle code reviews?", why: "Limited PR activity." },
    { question: "Walk me through your CI/CD setup.", why: "No CI configuration found." },
    { question: "How do you approach documentation?", why: "Minimal READMEs." },
  ],
  dataQualityWarnings: [],
};

const MOCK_NARRATIVE = "This developer shows clean, consistent code style across a variety of web, CLI, and API projects, suggesting solid fundamentals and a willingness to explore different problem domains. Their repos demonstrate an ability to ship working software, though the projects remain relatively straightforward in scope.\n\nThe standout quality is code consistency — naming conventions and project structure are clean across cool-project and another-repo, indicating good habits even in personal work. The range of project types also suggests adaptability and curiosity about different areas of development.\n\nHowever, the complete absence of tests, CI/CD pipelines, and meaningful documentation across all repos is a significant gap for anyone targeting mid-level or senior roles. Adding even basic test coverage and a GitHub Actions workflow to cool-project would substantially strengthen this profile. Given the current state, a cautious approach to hiring is warranted until these engineering practice gaps are addressed.";

export function buildMockSearchResults(query: string): GitHubSearchResult[] {
  if (!query.trim()) return [];
  const username = query.trim().toLowerCase();
  return [
    {
      username,
      name: `Mock User (${username})`,
      avatarUrl: "https://avatars.githubusercontent.com/u/0",
      bio: "Mock bio for deterministic E2E testing.",
      location: "San Francisco, CA",
      company: "@mock-org",
      repos: 12,
      followers: 150,
    },
  ];
}

function buildMockRepoSnapshots(username: string): RepoSnapshot[] {
  return [
    {
      name: "cool-project",
      fileTree: "src/\n  index.ts\n  lib/\npackage.json\ntsconfig.json\nREADME.md",
      hasTests: false,
      hasCI: false,
      hasLintConfig: true,
      hasDockerfile: false,
      hasBuildSystem: false,
      readmeWordCount: 120,
      releaseCount: 0,
      latestReleaseDaysAgo: -1,
      contributorCount: 1,
      latestPushDaysAgo: 30,
      openIssuesCount: 3,
      pullRequestsCount: 2,
      sourceFileCount: 8,
      totalLOC: 450,
      maxFileLOC: 120,
      largestFilePath: "src/index.ts",
      srcDirPresent: true,
      hasReleaseDiscipline: false,
    },
    {
      name: "another-repo",
      fileTree: "index.js\npackage.json\nREADME.md",
      hasTests: false,
      hasCI: false,
      hasLintConfig: false,
      hasDockerfile: false,
      hasBuildSystem: false,
      readmeWordCount: 40,
      releaseCount: 0,
      latestReleaseDaysAgo: -1,
      contributorCount: 1,
      latestPushDaysAgo: 60,
      openIssuesCount: 1,
      pullRequestsCount: 0,
      sourceFileCount: 3,
      totalLOC: 180,
      maxFileLOC: 80,
      largestFilePath: "index.js",
      srcDirPresent: false,
      hasReleaseDiscipline: false,
    },
  ];
}

function buildMockAggregateMetrics(): AggregateMetrics {
  return {
    medianLatestPushDaysAgo: 45,
    hasCode: true,
  };
}

export function buildMockGitHubData(username: string): GitHubUserData {
  return {
    profile: {
      username,
      name: `Mock User (${username})`,
      avatarUrl: `https://avatars.githubusercontent.com/u/0`,
      bio: "Mock bio for deterministic E2E testing.",
      company: "@mock-org",
      location: "San Francisco, CA",
      blog: "https://example.com",
      followers: 150,
      following: 30,
      publicRepos: 12,
      createdAt: "2018-01-15T00:00:00Z",
    },
    repositories: [
      {
        name: "cool-project",
        fullName: `${username}/cool-project`,
        description: "A cool project for testing.",
        url: `https://github.com/${username}/cool-project`,
        homepage: null,
        language: "TypeScript",
        stars: 42,
        forks: 5,
        watchers: 42,
        openIssues: 3,
        isFork: false,
        isArchived: false,
        topics: ["typescript", "testing"],
        createdAt: "2020-03-01T00:00:00Z",
        updatedAt: "2024-11-01T00:00:00Z",
        pushedAt: "2024-11-01T00:00:00Z",
      },
      {
        name: "another-repo",
        fullName: `${username}/another-repo`,
        description: "Another repository.",
        url: `https://github.com/${username}/another-repo`,
        homepage: null,
        language: "JavaScript",
        stars: 10,
        forks: 2,
        watchers: 10,
        openIssues: 1,
        isFork: false,
        isArchived: false,
        topics: ["javascript"],
        createdAt: "2021-06-15T00:00:00Z",
        updatedAt: "2024-10-01T00:00:00Z",
        pushedAt: "2024-10-01T00:00:00Z",
      },
    ],
    topRepositories: [
      {
        name: "cool-project",
        fullName: `${username}/cool-project`,
        description: "A cool project for testing.",
        url: `https://github.com/${username}/cool-project`,
        homepage: null,
        language: "TypeScript",
        stars: 42,
        forks: 5,
        watchers: 42,
        openIssues: 3,
        isFork: false,
        isArchived: false,
        topics: ["typescript", "testing"],
        createdAt: "2020-03-01T00:00:00Z",
        updatedAt: "2024-11-01T00:00:00Z",
        pushedAt: "2024-11-01T00:00:00Z",
      },
      {
        name: "another-repo",
        fullName: `${username}/another-repo`,
        description: "Another repository.",
        url: `https://github.com/${username}/another-repo`,
        homepage: null,
        language: "JavaScript",
        stars: 10,
        forks: 2,
        watchers: 10,
        openIssues: 1,
        isFork: false,
        isArchived: false,
        topics: ["javascript"],
        createdAt: "2021-06-15T00:00:00Z",
        updatedAt: "2024-10-01T00:00:00Z",
        pushedAt: "2024-10-01T00:00:00Z",
      },
    ],
    languages: [
      { name: "TypeScript", color: "#3178c6", percentage: 50, repoCount: 6 },
      { name: "JavaScript", color: "#f1e05a", percentage: 33.3, repoCount: 4 },
      { name: "Python", color: "#3572A5", percentage: 16.7, repoCount: 2 },
    ],
    activity: {
      totalEvents: 85,
      pushEvents: 50,
      prEvents: 15,
      issueEvents: 10,
      reviewEvents: 10,
      recentActiveRepos: [`${username}/cool-project`, `${username}/another-repo`],
    },
    stats: {
      totalStars: 52,
      totalForks: 7,
      originalRepos: 10,
      accountAgeDays: 2500,
      reposTruncated: false,
    },
    contributions: {
      totalContributions: 480,
      heatmap: Array.from({ length: 7 }, () =>
        Array.from({ length: 52 }, (_, i) => (i % 5 === 0 ? 0 : (i % 4) + 1)),
      ),
    },
    repoSnapshots: buildMockRepoSnapshots(username),
    aggregateMetrics: buildMockAggregateMetrics(),
  };
}

/** Hardcoded scoring result for mock mode (avoids dependency on scoring.service). */
const MOCK_SCORING_RESULT: ScoringResult = {
  overallScore: 55,
  candidateLevel: "Junior",
  recommendation: "Weak Hire",
  radarBreakdownScores: {
    "Code Quality": 6,
    "Project Complexity": 6,
    "Technical Breadth": 7,
    "Eng. Practices": 4,
    Consistency: 6,
    Collaboration: 3,
  },
  riskSignals: { concerningCount: 0, notableCount: 1 },
  confidenceScore: 0.95,
  rubricVersion: "v1.1",
  modelVersion: "mock",
};

/**
 * Build a full mock report using hardcoded scorer + scoring data.
 */
export function buildMockReport(githubData: GitHubUserData) {
  return buildReportData(MOCK_SCORER_RESPONSE, MOCK_SCORING_RESULT, MOCK_NARRATIVE, githubData);
}

export const MOCK_ADVICE_RESPONSE: AdviceV2 = {
  schemaVersion: "v2",
  generationWarnings: [],
  summary: "Focus on testing and documentation to level up your profile.",
  trajectory: {
    currentEstimate: "Junior",
    targetEstimate: "Mid-Level",
    confidence: "Medium",
    rationale: "Your repos show clean code fundamentals but lack tests and CI, placing you at Junior level. Repo complexity is moderate with straightforward CRUD-style projects. Language breadth covers TypeScript and JavaScript but stays within the JS ecosystem. Collaboration signals are limited with single-contributor repos and few PRs. Engineering practices are weak — no test files or CI pipelines detected. Push cadence is consistent with recent activity in the last 60 days.",
    calibration: {
      complexity: "Moderate — straightforward projects without multi-service architecture.",
      breadth: "TypeScript and JavaScript only, limited to the JS ecosystem.",
      collaboration: "Single-contributor repos with minimal PR activity.",
      engineeringPractices: "No tests, no CI/CD, basic linting config in one repo.",
      consistency: "Active pushes within last 60 days, regular cadence.",
    },
  },
  buildRoadmap: [
    {
      title: "REST API with Full Test Suite",
      projectOutcome: "A production-grade REST API demonstrating TDD and CI/CD mastery.",
      difficulty: "Intermediate",
      estimatedWeeks: 4,
      techStack: ["Node.js", "Express", "Vitest", "Supertest", "GitHub Actions", "Docker"],
      milestones: ["API scaffolding with route tests", "Integration test suite", "CI pipeline with coverage gate", "Docker deployment"],
      hiringSignals: ["Test coverage badge in README", "Green CI pipeline visible in repo"],
      evidence: "cool-project has no tests or CI — this build directly addresses that gap.",
    },
    {
      title: "CLI Tool with CI/CD",
      projectOutcome: "A published npm CLI tool with automated release pipeline.",
      difficulty: "Beginner",
      estimatedWeeks: 3,
      techStack: ["TypeScript", "Commander", "GitHub Actions", "npm", "Changesets", "Vitest"],
      milestones: ["CLI scaffolding with argument parsing", "Unit tests and CI setup", "Automated npm publish on tag"],
      hiringSignals: ["Published package on npm", "Automated release workflow"],
      evidence: "No evidence of CI/CD or package publishing in current repos.",
    },
    {
      title: "Full-Stack Dashboard",
      projectOutcome: "A real-time data dashboard showing full-stack and WebSocket skills.",
      difficulty: "Advanced",
      estimatedWeeks: 5,
      techStack: ["React", "WebSocket", "PostgreSQL", "Prisma", "Tailwind CSS", "Vitest", "Playwright"],
      milestones: ["Database schema and API layer", "Real-time WebSocket integration", "Frontend dashboard with charts", "E2E test suite", "Production deployment"],
      hiringSignals: ["Live deployed URL in README", "Full-stack architecture with real-time features"],
      evidence: "No full-stack or real-time projects in current profile.",
    },
  ],
  skillRoadmap: [
    {
      skill: "Docker",
      priority: "Now",
      demandLevel: "High",
      relatedTo: "Node.js",
      reason: "Essential for modern deployment — containerizing your API build makes it production-ready.",
      proofOfLearning: "Add a Dockerfile and docker-compose.yml to Build #1.",
      evidence: "No Dockerfiles found in any repos.",
    },
    {
      skill: "GraphQL",
      priority: "Next",
      demandLevel: "Growing",
      relatedTo: "REST APIs",
      reason: "Growing API paradigm that complements your REST experience.",
      proofOfLearning: "Add a GraphQL endpoint to the Full-Stack Dashboard build.",
      evidence: "All repos use REST — no GraphQL exposure.",
    },
    {
      skill: "Kubernetes",
      priority: "Later",
      demandLevel: "High",
      relatedTo: "Docker",
      reason: "Container orchestration is the next step after Docker for production systems.",
      proofOfLearning: "Deploy one build to a k8s cluster with a Helm chart.",
      evidence: "No container orchestration experience visible.",
    },
    {
      skill: "Redis",
      priority: "Next",
      demandLevel: "High",
      relatedTo: "Node.js",
      reason: "Caching and session management are critical for production APIs.",
      proofOfLearning: "Add Redis caching layer to the REST API build.",
      evidence: "No caching infrastructure in current repos.",
    },
  ],
  repoImprovements: [
    {
      repoName: "cool-project",
      improvements: [
        { area: "Testing", suggestion: "Add unit tests with Vitest covering core modules.", priority: "High", expectedOutcome: "Test coverage badge and confidence in refactoring." },
        { area: "CI/CD", suggestion: "Add GitHub Actions workflow for lint, test, and build.", priority: "High", expectedOutcome: "Green CI badge visible to recruiters on repo page." },
        { area: "Documentation", suggestion: "Expand README with setup instructions, architecture diagram, and API docs.", priority: "Medium", expectedOutcome: "Recruiters can understand the project in 30 seconds." },
      ],
    },
    {
      repoName: "another-repo",
      improvements: [
        { area: "Testing", suggestion: "Add at least 3 unit tests covering main functionality.", priority: "High", expectedOutcome: "Demonstrates testing habit across repos, not just one." },
        { area: "Code Quality", suggestion: "Add ESLint config and fix all warnings.", priority: "Medium", expectedOutcome: "Consistent code style signals professional habits." },
      ],
    },
  ],
  contributionStrategy: [
    {
      title: "Write descriptive commit messages",
      detail: "Use conventional commits format (feat:, fix:, docs:) consistently.",
      evidence: "Current commits use generic messages like 'update' and 'fix stuff'.",
    },
    {
      title: "Contribute to open source",
      detail: "Start with documentation PRs to popular Node.js projects, then progress to bug fixes.",
      evidence: "No contributions to repos outside personal projects.",
    },
    {
      title: "Review others' PRs",
      detail: "Join a project with active PRs and leave thoughtful code reviews.",
      evidence: "No review activity detected in events.",
    },
  ],
  profileOptimizations: [
    {
      area: "Bio",
      current: "Mock bio for deterministic E2E testing.",
      suggestion: "Replace with a focused professional bio highlighting your stack and goals.",
      example: "Full-stack TypeScript engineer building tested, production-grade APIs and tools.",
      impact: "Recruiters form first impressions from the bio — a focused one signals professionalism.",
    },
    {
      area: "Pinned Repos",
      current: "Default (no pinned repos)",
      suggestion: "Pin your 3 best repos that showcase different skills.",
      example: "Pin cool-project, the REST API build, and the CLI tool.",
      impact: "Pinned repos are the first thing visitors see — curate them like a portfolio.",
    },
    {
      area: "Profile README",
      current: "Missing",
      suggestion: "Create a README.md profile with tech stack badges and project highlights.",
      example: "Add shields.io badges for TypeScript, Node.js, and Docker with a 2-line intro.",
      impact: "Profile README makes your page stand out and shows attention to presentation.",
    },
    {
      area: "Repo Descriptions",
      current: "Generic or missing descriptions on most repos",
      suggestion: "Add one-line descriptions with the key technology and purpose.",
      example: "cool-project: 'TypeScript REST API with Vitest test suite and Docker deployment'",
      impact: "Descriptions appear in search results and pinned repo cards.",
    },
  ],
  weeklyRoadmap: [
    { week: 1, activeBuildTitle: "REST API with Full Test Suite", focus: "Project scaffolding and first route tests", deliverable: "API scaffolding with route tests", tasks: ["Set up Express + TypeScript project", "Write first 3 route tests with Supertest"], skillTask: "Complete Docker getting-started tutorial", successCheck: "3 passing route tests in CI" },
    { week: 2, activeBuildTitle: "REST API with Full Test Suite", focus: "Expand test coverage and add integration tests", deliverable: "Integration test suite", tasks: ["Add database integration tests", "Set up test fixtures and factories"], skillTask: "Write a Dockerfile for the API", successCheck: "10+ tests passing with integration layer" },
    { week: 3, activeBuildTitle: "REST API with Full Test Suite", focus: "CI pipeline and coverage gating", deliverable: "CI pipeline with coverage gate", tasks: ["Create GitHub Actions workflow", "Add coverage threshold enforcement"], skillTask: "Add docker-compose for local dev", successCheck: "CI pipeline green with coverage badge in README" },
    { week: 4, activeBuildTitle: "REST API with Full Test Suite", focus: "Docker deployment and documentation", deliverable: "Docker deployment", tasks: ["Create production Dockerfile", "Write comprehensive README with setup guide"], skillTask: "Deploy container to a cloud platform", successCheck: "Dockerized API running with complete README" },
    { week: 5, activeBuildTitle: "CLI Tool with CI/CD", focus: "CLI scaffolding and argument parsing", deliverable: "CLI scaffolding with argument parsing", tasks: ["Set up Commander-based CLI structure", "Add help text and input validation"], skillTask: "Study npm package publishing workflow", successCheck: "CLI runs locally with --help output" },
    { week: 6, activeBuildTitle: "CLI Tool with CI/CD", focus: "Tests and CI setup", deliverable: "Unit tests and CI setup", tasks: ["Write unit tests for all commands", "Set up GitHub Actions CI"], skillTask: "Learn Changesets for version management", successCheck: "All tests passing in CI" },
    { week: 7, activeBuildTitle: "CLI Tool with CI/CD", focus: "Automated publishing", deliverable: "Automated npm publish on tag", tasks: ["Configure Changesets for releases", "Set up automated npm publish workflow"], skillTask: "Publish first version to npm", successCheck: "Package live on npm with automated release" },
    { week: 8, activeBuildTitle: "Full-Stack Dashboard", focus: "Database and API layer", deliverable: "Database schema and API layer", tasks: ["Design PostgreSQL schema with Prisma", "Build REST API endpoints for dashboard data"], skillTask: "Study WebSocket fundamentals", successCheck: "API endpoints returning data from PostgreSQL" },
    { week: 9, activeBuildTitle: "Full-Stack Dashboard", focus: "Real-time WebSocket integration", deliverable: "Real-time WebSocket integration", tasks: ["Add WebSocket server for live updates", "Connect frontend to WebSocket feed"], skillTask: "Implement Redis pub/sub for WebSocket scaling", successCheck: "Dashboard shows live-updating data" },
    { week: 10, activeBuildTitle: "Full-Stack Dashboard", focus: "Frontend dashboard with charts", deliverable: "Frontend dashboard with charts", tasks: ["Build chart components with Recharts", "Add responsive Tailwind layout"], skillTask: "Study Playwright for E2E testing", successCheck: "Dashboard renders charts with real data" },
    { week: 11, activeBuildTitle: "Full-Stack Dashboard", focus: "E2E testing", deliverable: "E2E test suite", tasks: ["Write Playwright tests for critical flows", "Add E2E tests to CI pipeline"], skillTask: "Learn GraphQL basics for future API work", successCheck: "E2E tests passing in CI" },
    { week: 12, activeBuildTitle: "Full-Stack Dashboard", focus: "Production deployment and polish", deliverable: "Production deployment", tasks: ["Deploy to cloud with public URL", "Final README with architecture diagram and live link"], skillTask: "Review all 12 weeks and consolidate learnings", successCheck: "Live URL in README, all builds deployed and documented" },
  ],
  strengthsAndGaps: {
    strengths: [
      { area: "Clean Code Fundamentals", detail: "cool-project shows consistent naming conventions and separation of concerns across modules." },
      { area: "Consistent Activity", detail: "Regular push cadence with commits in the last 60 days across multiple repos." },
      { area: "TypeScript Adoption", detail: "All recent repos use TypeScript with strict mode, showing type safety awareness." },
    ],
    gaps: [
      { area: "Testing", detail: "No test files found in any repository — this is the biggest gap for moving to Mid-Level." },
      { area: "CI/CD", detail: "No GitHub Actions or other CI pipelines detected in any repo." },
      { area: "Collaboration Evidence", detail: "All repos are single-contributor with no PR reviews or issue discussions." },
    ],
  },
  careerPositioning: {
    positioning: "Position yourself as a TypeScript-focused developer building toward full-stack production readiness. Lead with your consistent activity and clean code patterns, and frame your upcoming builds as evidence of your commitment to professional engineering practices.",
    roles: ["Junior Full-Stack TypeScript Developer", "Junior Backend Engineer (Node.js)", "Frontend Developer (React/TypeScript)"],
    differentiators: [
      "Consistent commit cadence showing sustained effort — not a hobbyist pattern.",
      "Clean TypeScript fundamentals with strict mode across all repos.",
      "Active recent work (last 60 days) signals engagement and growth trajectory.",
    ],
  },
  successMetrics: [
    "Reach 3+ merged PRs to OSS repos outside personal projects within 12 weeks.",
    "Deploy all 3 portfolio builds with public URLs by week 12.",
    "Publish the CLI tool to npm with automated release pipeline by week 7.",
    "Achieve 80%+ test coverage on the REST API build by week 4.",
    "Maintain weekly commit streak for 12 consecutive weeks.",
    "Ship a working CI pipeline for every portfolio project by week 12.",
  ],
};
