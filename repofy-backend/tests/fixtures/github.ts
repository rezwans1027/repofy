import type {
  GitHubApiUser,
  GitHubApiRepo,
  GitHubApiEvent,
  GitHubApiSearchResponse,
  GitHubUserData,
  GitHubProfile,
  GitHubRepo,
  LanguageBreakdown,
  ActivitySummary,
  GitHubStats,
} from "../../src/types";

export function createGitHubApiUser(overrides: Partial<GitHubApiUser> = {}): GitHubApiUser {
  return {
    login: "octocat",
    name: "The Octocat",
    avatar_url: "https://avatars.githubusercontent.com/u/583231",
    bio: "GitHub mascot",
    company: "@github",
    location: "San Francisco",
    blog: "https://github.blog",
    followers: 1000,
    following: 10,
    public_repos: 8,
    created_at: "2011-01-25T18:44:36Z",
    ...overrides,
  };
}

export function createGitHubApiRepo(overrides: Partial<GitHubApiRepo> = {}): GitHubApiRepo {
  return {
    name: "cool-project",
    full_name: "octocat/cool-project",
    description: "A cool project",
    html_url: "https://github.com/octocat/cool-project",
    homepage: null,
    language: "TypeScript",
    stargazers_count: 42,
    forks_count: 5,
    watchers_count: 42,
    open_issues_count: 2,
    fork: false,
    archived: false,
    topics: ["typescript", "web"],
    created_at: "2020-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    pushed_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

export function createGitHubApiRepoList(count: number): GitHubApiRepo[] {
  return Array.from({ length: count }, (_, i) =>
    createGitHubApiRepo({
      name: `repo-${i}`,
      full_name: `octocat/repo-${i}`,
      stargazers_count: count - i,
      language: i % 2 === 0 ? "TypeScript" : "JavaScript",
    }),
  );
}

export function createGitHubApiEvent(type: string): GitHubApiEvent {
  return {
    type,
    repo: { name: "octocat/cool-project" },
    created_at: "2024-01-15T10:00:00Z",
  };
}

export function createSearchResponse(logins: string[]): GitHubApiSearchResponse {
  return {
    total_count: logins.length,
    incomplete_results: false,
    items: logins.map((login) => ({
      login,
      avatar_url: `https://avatars.githubusercontent.com/${login}`,
    })),
  };
}

export function createContributionResponse() {
  const weeks = Array.from({ length: 52 }, () => ({
    contributionDays: Array.from({ length: 7 }, () => ({
      contributionCount: Math.floor(Math.random() * 5),
    })),
  }));

  return {
    data: {
      user: {
        contributionsCollection: {
          contributionCalendar: {
            totalContributions: 365,
            weeks,
          },
        },
      },
    },
  };
}

function createGitHubProfile(overrides: Partial<GitHubProfile> = {}): GitHubProfile {
  return {
    username: "octocat",
    name: "The Octocat",
    avatarUrl: "https://avatars.githubusercontent.com/u/583231",
    bio: "GitHub mascot",
    company: "@github",
    location: "San Francisco",
    blog: "https://github.blog",
    followers: 1000,
    following: 10,
    publicRepos: 8,
    createdAt: "2011-01-25T18:44:36Z",
    ...overrides,
  };
}

function createGitHubRepo(overrides: Partial<GitHubRepo> = {}): GitHubRepo {
  return {
    name: "cool-project",
    fullName: "octocat/cool-project",
    description: "A cool project",
    url: "https://github.com/octocat/cool-project",
    homepage: null,
    language: "TypeScript",
    stars: 42,
    forks: 5,
    watchers: 42,
    openIssues: 2,
    isFork: false,
    isArchived: false,
    topics: ["typescript", "web"],
    createdAt: "2020-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    pushedAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

export function createGitHubUserData(overrides: Partial<GitHubUserData> = {}): GitHubUserData {
  const defaultRepos = [
    createGitHubRepo({ name: "cool-project", stars: 42 }),
    createGitHubRepo({ name: "another-repo", language: "JavaScript", stars: 10 }),
  ];

  const defaultLanguages: LanguageBreakdown[] = [
    { name: "TypeScript", color: "#3178c6", percentage: 60, repoCount: 3 },
    { name: "JavaScript", color: "#f1e05a", percentage: 40, repoCount: 2 },
  ];

  const defaultActivity: ActivitySummary = {
    totalEvents: 50,
    pushEvents: 30,
    prEvents: 10,
    issueEvents: 5,
    reviewEvents: 5,
    recentActiveRepos: ["octocat/cool-project", "octocat/another-repo"],
  };

  const defaultStats: GitHubStats = {
    totalStars: 52,
    totalForks: 8,
    originalRepos: 6,
    accountAgeDays: 4500,
    reposTruncated: false,
  };

  return {
    profile: createGitHubProfile(),
    repositories: defaultRepos,
    topRepositories: defaultRepos,
    languages: defaultLanguages,
    activity: defaultActivity,
    stats: defaultStats,
    contributions: { totalContributions: 365, heatmap: [] },
    ...overrides,
  };
}
