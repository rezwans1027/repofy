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

// ── AI Analysis types ─────────────────────────────────────────────────

export interface AIAnalysisResponse {
  candidateLevel: string;
  overallScore: number;
  recommendation: string;
  summary: string;
  radarAxes: { axis: string; value: number }[];
  radarBreakdown: { label: string; score: number; note: string }[];
  statsInterpretation: string;
  activityInterpretation: string;
  languageInterpretation: string;
  topRepos: {
    name: string;
    codeQuality: string;
    testing: string;
    cicd: string;
    verdict: string;
    isBestWork: boolean;
  }[];
  strengths: { text: string; evidence: string }[];
  weaknesses: { text: string; evidence: string }[];
  redFlags: { text: string; severity: string; explanation: string }[];
  interviewQuestions: { question: string; why: string }[];
}

// ── AI Advice types ──────────────────────────────────────────────────

export interface AIAdviceResponse {
  summary: string;
  projectIdeas: {
    title: string;
    description: string;
    techStack: string[];
    difficulty: "Beginner" | "Intermediate" | "Advanced";
    why: string;
  }[];
  repoImprovements: {
    repoName: string;
    improvements: {
      area: "Testing" | "Documentation" | "CI/CD" | "Code Quality" | "Architecture";
      suggestion: string;
      priority: "High" | "Medium" | "Low";
    }[];
  }[];
  skillsToLearn: {
    skill: string;
    reason: string;
    demandLevel: "High" | "Medium" | "Growing";
    relatedTo: string;
  }[];
  contributionAdvice: { title: string; detail: string }[];
  profileOptimizations: { area: string; current: string; suggestion: string }[];
  actionPlan: {
    timeframe: "30 days" | "60 days" | "90 days";
    actions: string[];
  }[];
}
