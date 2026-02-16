import type { AIAnalysisResponse, AIAdviceResponse } from "../../src/types";

export function createAIAnalysisResponse(overrides: Partial<AIAnalysisResponse> = {}): AIAnalysisResponse {
  return {
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

export function createAIAdviceResponse(overrides: Partial<AIAdviceResponse> = {}): AIAdviceResponse {
  return {
    summary: "Focus on testing and documentation.",
    projectIdeas: [
      {
        title: "REST API with Tests",
        description: "Build a tested REST API.",
        techStack: ["Node.js", "Express", "Vitest"],
        difficulty: "Intermediate",
        why: "Shows testing skills.",
      },
    ],
    repoImprovements: [
      {
        repoName: "cool-project",
        improvements: [
          { area: "Testing", suggestion: "Add unit tests.", priority: "High" },
        ],
      },
    ],
    skillsToLearn: [
      { skill: "Docker", reason: "Essential for deployment.", demandLevel: "High", relatedTo: "Node.js" },
    ],
    contributionAdvice: [
      { title: "Use conventional commits", detail: "Improves readability." },
    ],
    profileOptimizations: [
      { area: "Bio", current: "Missing", suggestion: "Add a bio." },
    ],
    actionPlan: [
      { timeframe: "30 days", actions: ["Add tests", "Set up CI"] },
      { timeframe: "60 days", actions: ["Start new project"] },
      { timeframe: "90 days", actions: ["Polish repos"] },
    ],
    ...overrides,
  };
}

export function createShuffledRadarResponse(): AIAnalysisResponse {
  return createAIAnalysisResponse({
    radarAxes: [
      { axis: "Collaboration", value: 0.4 },
      { axis: "Code Quality", value: 0.7 },
      { axis: "Consistency", value: 0.55 },
      { axis: "Technical Breadth", value: 0.65 },
      { axis: "Project Complexity", value: 0.6 },
      { axis: "Eng. Practices", value: 0.5 },
    ],
    radarBreakdown: [
      { label: "Collaboration", score: 4, note: "Limited." },
      { label: "Code Quality", score: 7, note: "Clean." },
      { label: "Consistency", score: 5.5, note: "Regular." },
      { label: "Technical Breadth", score: 6.5, note: "Good range." },
      { label: "Project Complexity", score: 6, note: "Moderate." },
      { label: "Eng. Practices", score: 5, note: "Some CI." },
    ],
  });
}
