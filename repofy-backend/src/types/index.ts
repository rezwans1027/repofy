import type { Request } from "express";
import type {
  CandidateLevel,
  Recommendation,
  RedFlagSeverity,
  RepoVerdict,
} from "./shared/report";
import type { GenerationWarning } from "./shared/advice";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
      githubToken?: string;
      signal?: AbortSignal;
      requestId: string;
    }
  }
}

/** Request type for routes behind `requireAuth` middleware — userId is guaranteed. */
export interface AuthenticatedRequest extends Request {
  userId: string;
  userEmail: string;
  githubToken?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ── GitHub API raw types ──────────────────────────────────────────────

export interface GitHubApiUser {
  login: string;
  name: string | null;
  avatar_url: string;
  bio: string | null;
  company: string | null;
  location: string | null;
  blog: string | null;
  followers: number;
  following: number;
  public_repos: number;
  created_at: string;
}

export interface GitHubApiRepo {
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  open_issues_count: number;
  fork: boolean;
  archived: boolean;
  topics: string[];
  created_at: string;
  updated_at: string;
  pushed_at: string;
}

export interface GitHubApiEvent {
  type: string;
  repo: { name: string };
  created_at: string;
}

// ── GitHub response types ─────────────────────────────────────────────

export interface GitHubProfile {
  username: string;
  name: string | null;
  avatarUrl: string;
  bio: string | null;
  company: string | null;
  location: string | null;
  blog: string | null;
  followers: number;
  following: number;
  publicRepos: number;
  createdAt: string;
}

export interface GitHubRepo {
  name: string;
  fullName: string;
  description: string | null;
  url: string;
  homepage: string | null;
  language: string | null;
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  isFork: boolean;
  isArchived: boolean;
  topics: string[];
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
}

export interface LanguageBreakdown {
  name: string;
  color: string;
  percentage: number;
  repoCount: number;
}

export interface ActivitySummary {
  totalEvents: number;
  pushEvents: number;
  prEvents: number;
  issueEvents: number;
  reviewEvents: number;
  recentActiveRepos: string[];
}

export interface GitHubStats {
  totalStars: number;
  totalForks: number;
  originalRepos: number;
  accountAgeDays: number;
  reposTruncated: boolean;
}

export interface ContributionCalendar {
  totalContributions: number;
  heatmap: number[][]; // 7 rows (days) x 52 cols (weeks), values 0-4
}

export interface GitHubUserData {
  profile: GitHubProfile;
  repositories: GitHubRepo[];
  topRepositories: GitHubRepo[];
  languages: LanguageBreakdown[];
  activity: ActivitySummary;
  stats: GitHubStats;
  contributions: ContributionCalendar | null;
  repoSnapshots: RepoSnapshot[];
  aggregateMetrics: AggregateMetrics;
}

// ── GitHub search types ───────────────────────────────────────────────

export interface GitHubApiSearchResponse {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubApiSearchItem[];
}

export interface GitHubApiSearchItem {
  login: string;
  avatar_url: string;
}

export interface GitHubSearchResult {
  username: string;
  name: string | null;
  avatarUrl: string;
  bio: string | null;
  location: string | null;
  company: string | null;
  repos: number;
  followers: number;
}

// ── Repo snapshot types ───────────────────────────────────────────────

export interface RepoSnapshot {
  name: string;
  fileTree: string;
  hasTests: boolean;
  hasCI: boolean;
  hasLintConfig: boolean;
  hasDockerfile: boolean;
  hasBuildSystem: boolean;
  readmeWordCount: number;
  releaseCount: number;
  latestReleaseDaysAgo: number;
  contributorCount: number;
  latestPushDaysAgo: number;
  openIssuesCount: number;
  pullRequestsCount: number;
  sourceFileCount: number;
  totalLOC: number;
  maxFileLOC: number;
  largestFilePath: string;
  srcDirPresent: boolean;
  hasReleaseDiscipline: boolean;
  codeSnippets?: string[];
}

export interface AggregateMetrics {
  medianLatestPushDaysAgo: number;
  hasCode: boolean;
}

// ── AI Analysis types ─────────────────────────────────────────────────

// Re-exported from shared/types/ via TS project references
export type { CandidateLevel, Recommendation, RedFlagSeverity, RepoVerdict };
export type { GenerationWarning };

export type AxisLabel =
  | "Code Quality"
  | "Project Complexity"
  | "Technical Breadth"
  | "Eng. Practices"
  | "Consistency"
  | "Collaboration";

// Scorer-specific names for types that map to shared/types/report.ts equivalents
// (CodeQuality, TestingLevel, CiCdStatus) — kept separate since the AI scorer
// context differs from the frontend display context
export type CodeQualityGrade = "Excellent" | "Good" | "Mixed" | "Weak" | "Unknown";
export type TestingGrade = "Strong" | "Some" | "None" | "Unknown";
export type CicdGrade = "Present" | "Partial" | "None" | "Unknown";

export interface ScorerResponse {
  radarAxes: { axis: AxisLabel; value: number }[];
  radarBreakdown: { label: AxisLabel; note: string }[];
  topRepos: {
    name: string;
    codeQuality: CodeQualityGrade;
    testing: TestingGrade;
    cicd: CicdGrade;
    verdict: RepoVerdict;
    isBestWork: boolean;
  }[];
  strengths: { text: string; evidence: string }[];
  weaknesses: { text: string; evidence: string }[];
  redFlags: { text: string; severity: RedFlagSeverity; explanation: string }[];
  interviewQuestions: { question: string; why: string }[];
  statsInterpretation: string;
  activityInterpretation: string;
  languageInterpretation: string;
  dataQualityWarnings: string[];
}

export interface ScoringResult {
  overallScore: number;
  candidateLevel: CandidateLevel;
  recommendation: Recommendation;
  radarBreakdownScores: Record<AxisLabel, number>;
  riskSignals: { concerningCount: number; notableCount: number };
  confidenceScore: number;
  rubricVersion: string;
  modelVersion: string;
}

// ── AI Advice V2 types ───────────────────────────────────────────────

export type Confidence = "Low" | "Medium" | "High";

export const GENERATION_WARNINGS = {
  REPO_IMPROVEMENTS_UNAVAILABLE: "repo_improvements_unavailable",
  REPO_IMPROVEMENTS_REDUCED: "repo_improvements_reduced",
  WEEKLY_ROADMAP_SYNTHESIZED: "weekly_roadmap_synthesized",
  SUCCESS_METRICS_REDUCED: "success_metrics_reduced",
  PROFILE_OPTIMIZATIONS_REDUCED: "profile_optimizations_reduced",
  SKILL_ROADMAP_REDUCED: "skill_roadmap_reduced",
  CONTRIBUTION_STRATEGY_REDUCED: "contribution_strategy_reduced",
  STRENGTHS_AND_GAPS_REDUCED: "strengths_and_gaps_reduced",
  CAREER_POSITIONING_REDUCED: "career_positioning_reduced",
} as const satisfies Record<string, GenerationWarning>;

/**
 * Raw AI-generated advice output — the shape returned directly by the LLM.
 *
 * This type contains only AI-produced fields. It does NOT include enrichment
 * data (repo URLs, language colors, star counts) that come from GitHub.
 *
 * After generation, `buildAdviceData()` in `advice-builder.service.ts` merges
 * an `AdviceV2` with `GitHubUserData` to produce the enriched `AdviceData`
 * (defined in `types/shared/advice.ts`) that is sent to the frontend.
 *
 * @see AdviceData  — the enriched, frontend-ready shape
 * @see buildAdviceData — the function that performs the AdviceV2 → AdviceData transform
 */
export interface AdviceV2 {
  schemaVersion: "v2";
  generationWarnings: GenerationWarning[];

  summary: string;

  trajectory: {
    currentEstimate: CandidateLevel;
    targetEstimate: CandidateLevel;
    confidence: Confidence;
    rationale: string;
    calibration: {
      complexity: string;
      breadth: string;
      collaboration: string;
      engineeringPractices: string;
      consistency: string;
    };
  };

  buildRoadmap: {
    title: string;
    projectOutcome: string;
    difficulty: "Beginner" | "Intermediate" | "Advanced";
    estimatedWeeks: number;
    techStack: string[];
    milestones: string[];
    hiringSignals: string[];
    evidence: string;
  }[];

  skillRoadmap: {
    skill: string;
    priority: "Now" | "Next" | "Later";
    demandLevel: "High" | "Medium" | "Growing";
    relatedTo: string;
    reason: string;
    proofOfLearning: string;
    evidence: string;
  }[];

  repoImprovements: {
    repoName: string;
    improvements: {
      area: "Testing" | "Documentation" | "CI/CD" | "Code Quality" | "Architecture";
      suggestion: string;
      priority: "High" | "Medium" | "Low";
      expectedOutcome: string;
    }[];
  }[];

  contributionStrategy: {
    title: string;
    detail: string;
    evidence: string;
  }[];

  profileOptimizations: {
    area: string;
    current: string;
    suggestion: string;
    example: string;
    impact: string;
  }[];

  weeklyRoadmap: {
    week: number;
    activeBuildTitle: string;
    focus: string;
    deliverable: string;
    tasks: string[];
    skillTask: string;
    successCheck: string;
  }[];

  strengthsAndGaps: {
    strengths: { area: string; detail: string }[];
    gaps: { area: string; detail: string }[];
  };

  careerPositioning: {
    positioning: string;
    roles: string[];
    differentiators: string[];
  };

  successMetrics: string[];
}

/** Raw AI output before schemaVersion/warnings are added */
export type AdviceV2Raw = Omit<AdviceV2, "schemaVersion" | "generationWarnings">;

/** Section names for retry/merge logic */
export type AdviceSectionName = keyof AdviceV2Raw;
