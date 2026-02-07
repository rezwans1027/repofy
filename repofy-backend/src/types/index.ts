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

export interface GitHubUserData {
  profile: GitHubProfile;
  repositories: GitHubRepo[];
  topRepositories: GitHubRepo[];
  languages: LanguageBreakdown[];
  activity: ActivitySummary;
  stats: GitHubStats;
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
