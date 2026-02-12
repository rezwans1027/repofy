import type { AIAnalysisResponse, AIAdviceResponse } from "../types";

export const MOCK_ANALYSIS_RESPONSE: AIAnalysisResponse = {
  candidateLevel: "Mid-Level",
  overallScore: 62,
  recommendation: "Hire",
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
    { label: "Code Quality", score: 7, note: "Clean code with consistent style." },
    { label: "Project Complexity", score: 6, note: "Moderate complexity projects." },
    { label: "Technical Breadth", score: 6.5, note: "Good range of technologies." },
    { label: "Eng. Practices", score: 5, note: "Some CI but lacking tests." },
    { label: "Consistency", score: 5.5, note: "Regular commits." },
    { label: "Collaboration", score: 4, note: "Limited PR activity." },
  ],
  statsInterpretation: "Moderate GitHub presence with room for growth.",
  activityInterpretation: "Primarily push-based workflow.",
  languageInterpretation: "JavaScript-heavy with some TypeScript.",
  topRepos: [
    {
      name: "cool-project",
      codeQuality: "B+",
      testing: "C",
      cicd: "C",
      verdict: "Good project with room for improvement.",
      isBestWork: true,
    },
    {
      name: "another-repo",
      codeQuality: "B",
      testing: "D",
      cicd: "D",
      verdict: "Functional but needs tests.",
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
};

export const MOCK_ADVICE_RESPONSE: AIAdviceResponse = {
  summary: "Focus on testing and documentation to level up your profile.",
  projectIdeas: [
    {
      title: "REST API with Full Test Suite",
      description: "Build a REST API with comprehensive testing.",
      techStack: ["Node.js", "Express", "Vitest", "Supertest"],
      difficulty: "Intermediate",
      why: "Demonstrates testing and API design skills.",
    },
    {
      title: "CLI Tool with CI/CD",
      description: "Create a CLI tool with automated publishing.",
      techStack: ["TypeScript", "Commander", "GitHub Actions"],
      difficulty: "Beginner",
      why: "Shows CI/CD knowledge.",
    },
    {
      title: "Full-Stack Dashboard",
      description: "Build a data dashboard with real-time updates.",
      techStack: ["React", "WebSocket", "PostgreSQL"],
      difficulty: "Advanced",
      why: "Demonstrates full-stack and real-time skills.",
    },
  ],
  repoImprovements: [
    {
      repoName: "cool-project",
      improvements: [
        { area: "Testing", suggestion: "Add unit tests with Vitest.", priority: "High" },
        { area: "CI/CD", suggestion: "Add GitHub Actions workflow.", priority: "Medium" },
      ],
    },
  ],
  skillsToLearn: [
    { skill: "Docker", reason: "Essential for modern deployment.", demandLevel: "High", relatedTo: "Node.js" },
    { skill: "GraphQL", reason: "Growing API paradigm.", demandLevel: "Growing", relatedTo: "REST APIs" },
    { skill: "Kubernetes", reason: "Container orchestration.", demandLevel: "High", relatedTo: "Docker" },
  ],
  contributionAdvice: [
    { title: "Write descriptive commit messages", detail: "Use conventional commits format." },
    { title: "Contribute to open source", detail: "Start with documentation PRs." },
    { title: "Review others' PRs", detail: "Build collaboration evidence." },
  ],
  profileOptimizations: [
    { area: "Bio", current: "Missing", suggestion: "Add a concise bio with your focus areas." },
    { area: "Pinned Repos", current: "Default", suggestion: "Pin your best 6 repos." },
    { area: "Profile README", current: "Missing", suggestion: "Create a README.md profile." },
  ],
  actionPlan: [
    { timeframe: "30 days", actions: ["Add tests to top repo", "Set up CI/CD", "Update profile bio"] },
    { timeframe: "60 days", actions: ["Start new project with TDD", "Contribute to open source"] },
    { timeframe: "90 days", actions: ["Complete full-stack project", "Polish all repo READMEs"] },
  ],
};
