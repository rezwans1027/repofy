import { env } from "../config/env";
import { logger } from "../lib/logger";
import type {
  GitHubApiUser,
  GitHubApiRepo,
  GitHubApiEvent,
  GitHubApiSearchResponse,
  GitHubProfile,
  GitHubRepo,
  LanguageBreakdown,
  ActivitySummary,
  GitHubStats,
  GitHubUserData,
  GitHubSearchResult,
  ContributionCalendar,
} from "../types";

// ── Error class ───────────────────────────────────────────────────────

export class GitHubError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

// ── Language colors ───────────────────────────────────────────────────

export const LANGUAGE_COLORS: Record<string, string> = {
  JavaScript: "#f1e05a",
  TypeScript: "#3178c6",
  Python: "#3572A5",
  Java: "#b07219",
  Go: "#00ADD8",
  Rust: "#dea584",
  "C++": "#f34b7d",
  C: "#555555",
  "C#": "#178600",
  Ruby: "#701516",
  PHP: "#4F5D95",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  Dart: "#00B4AB",
  Shell: "#89e051",
  HTML: "#e34c26",
  CSS: "#563d7c",
  SCSS: "#c6538c",
  Vue: "#41b883",
  Svelte: "#ff3e00",
  Lua: "#000080",
  Haskell: "#5e5086",
  Elixir: "#6e4a7e",
  Scala: "#c22d40",
  R: "#198CE7",
  Jupyter: "#DA5B0B",
  Zig: "#ec915c",
  Nix: "#7e7eff",
  OCaml: "#3be133",
};

export const DEFAULT_COLOR = "#8b949e";

// ── GitHub API helpers ────────────────────────────────────────────────

const GITHUB_API = "https://api.github.com";

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "Repofy",
  };
  if (env.githubToken && !env.githubToken.startsWith("<")) {
    h.Authorization = `Bearer ${env.githubToken}`;
  }
  return h;
}

async function ghFetch<T>(path: string, signal?: AbortSignal): Promise<T> {
  const signals = [AbortSignal.timeout(15_000)];
  if (signal) signals.push(signal);
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: headers(),
    signal: AbortSignal.any(signals),
  }).catch((err) => {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new GitHubError("GitHub API request timed out", 504);
    }
    throw err;
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new GitHubError("User not found", 404);
    }
    if (res.status === 403 || res.status === 429) {
      throw new GitHubError(
        "GitHub API rate limit exceeded. Try again later or provide a GITHUB_TOKEN.",
        429,
      );
    }
    throw new GitHubError(`GitHub API error: ${res.status}`, res.status);
  }

  return res.json() as Promise<T>;
}

// ── GitHub GraphQL API helper ─────────────────────────────────────────

const GITHUB_GRAPHQL = "https://api.github.com/graphql";

async function ghGraphQL<T>(query: string, variables?: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const token = env.githubToken;
  if (!token || token.startsWith("<")) {
    throw new GitHubError("GitHub token required for GraphQL API", 401);
  }
  const signals = [AbortSignal.timeout(15_000)];
  if (signal) signals.push(signal);
  const res = await fetch(GITHUB_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "Repofy",
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.any(signals),
  }).catch((err) => {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new GitHubError("GitHub GraphQL request timed out", 504);
    }
    throw err;
  });
  if (!res.ok) throw new GitHubError(`GitHub GraphQL error: ${res.status}`, res.status);
  return res.json() as Promise<T>;
}

// ── Paginated repo fetch ──────────────────────────────────────────────

const MAX_REPO_PAGES = 10; // Cap at 1000 repos max

async function fetchAllRepos(username: string, signal?: AbortSignal): Promise<GitHubApiRepo[]> {
  const repos: GitHubApiRepo[] = [];
  let page = 1;
  const perPage = 100;

  while (page <= MAX_REPO_PAGES) {
    const batch = await ghFetch<GitHubApiRepo[]>(
      `/users/${username}/repos?per_page=${perPage}&page=${page}&sort=updated`,
      signal,
    );
    repos.push(...batch);
    if (batch.length < perPage) break;
    page++;
  }

  return repos;
}

// ── Data transformers ─────────────────────────────────────────────────

function mapProfile(user: GitHubApiUser): GitHubProfile {
  return {
    username: user.login,
    name: user.name,
    avatarUrl: user.avatar_url,
    bio: user.bio,
    company: user.company,
    location: user.location,
    blog: user.blog,
    followers: user.followers,
    following: user.following,
    publicRepos: user.public_repos,
    createdAt: user.created_at,
  };
}

function mapRepo(repo: GitHubApiRepo): GitHubRepo {
  return {
    name: repo.name,
    fullName: repo.full_name,
    description: repo.description,
    url: repo.html_url,
    homepage: repo.homepage,
    language: repo.language,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    watchers: repo.watchers_count,
    openIssues: repo.open_issues_count,
    isFork: repo.fork,
    isArchived: repo.archived,
    topics: repo.topics,
    createdAt: repo.created_at,
    updatedAt: repo.updated_at,
    pushedAt: repo.pushed_at,
  };
}

function buildLanguageBreakdown(repos: GitHubApiRepo[]): LanguageBreakdown[] {
  const langMap = new Map<string, number>();

  for (const repo of repos) {
    if (repo.language && !repo.fork) {
      langMap.set(repo.language, (langMap.get(repo.language) || 0) + 1);
    }
  }

  const total = Array.from(langMap.values()).reduce((a, b) => a + b, 0);
  if (total === 0) return [];

  return Array.from(langMap.entries())
    .map(([name, repoCount]) => ({
      name,
      color: LANGUAGE_COLORS[name] || DEFAULT_COLOR,
      percentage: Math.round((repoCount / total) * 1000) / 10,
      repoCount,
    }))
    .sort((a, b) => b.repoCount - a.repoCount);
}

function buildActivitySummary(events: GitHubApiEvent[]): ActivitySummary {
  let pushEvents = 0;
  let prEvents = 0;
  let issueEvents = 0;
  let reviewEvents = 0;
  const activeRepos = new Set<string>();

  for (const event of events) {
    activeRepos.add(event.repo.name);
    switch (event.type) {
      case "PushEvent":
        pushEvents++;
        break;
      case "PullRequestEvent":
        prEvents++;
        break;
      case "IssuesEvent":
        issueEvents++;
        break;
      case "PullRequestReviewEvent":
        reviewEvents++;
        break;
    }
  }

  return {
    totalEvents: events.length,
    pushEvents,
    prEvents,
    issueEvents,
    reviewEvents,
    recentActiveRepos: Array.from(activeRepos).slice(0, 10),
  };
}

function buildStats(
  user: GitHubApiUser,
  repos: GitHubApiRepo[],
): GitHubStats {
  let totalStars = 0;
  let totalForks = 0;
  let originalRepos = 0;

  for (const repo of repos) {
    totalStars += repo.stargazers_count;
    totalForks += repo.forks_count;
    if (!repo.fork) originalRepos++;
  }

  const accountAgeDays = Math.floor(
    (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24),
  );

  return { totalStars, totalForks, originalRepos, accountAgeDays };
}

// ── Contribution calendar (GraphQL) ───────────────────────────────────

interface GQLContributionDay {
  contributionCount: number;
}

interface GQLContributionWeek {
  contributionDays: GQLContributionDay[];
}

interface GQLContributionResponse {
  data: {
    user: {
      contributionsCollection: {
        contributionCalendar: {
          totalContributions: number;
          weeks: GQLContributionWeek[];
        };
      };
    };
  };
}

const CONTRIBUTION_QUERY = `
  query($username: String!) {
    user(login: $username) {
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              contributionCount
            }
          }
        }
      }
    }
  }
`;

function mapContributionsToHeatmap(weeks: GQLContributionWeek[]): number[][] {
  // Build 7 rows (days) x N cols (weeks)
  const rows: number[][] = Array.from({ length: 7 }, () => []);
  for (const week of weeks) {
    for (let day = 0; day < 7; day++) {
      const count = week.contributionDays[day]?.contributionCount ?? 0;
      rows[day].push(count);
    }
  }

  // Collect all non-zero counts for quartile bucketing
  const nonZero = rows.flat().filter((c) => c > 0).sort((a, b) => a - b);
  if (nonZero.length === 0) return rows.map((row) => row.map(() => 0));

  const q1 = nonZero[Math.floor(nonZero.length * 0.25)];
  const q2 = nonZero[Math.floor(nonZero.length * 0.5)];
  const q3 = nonZero[Math.floor(nonZero.length * 0.75)];

  function toLevel(count: number): number {
    if (count === 0) return 0;
    if (count <= q1) return 1;
    if (count <= q2) return 2;
    if (count <= q3) return 3;
    return 4;
  }

  return rows.map((row) => row.map(toLevel));
}

async function fetchContributionCalendar(
  username: string,
  signal?: AbortSignal,
): Promise<ContributionCalendar | null> {
  try {
    const result = await ghGraphQL<GQLContributionResponse>(
      CONTRIBUTION_QUERY,
      { username },
      signal,
    );
    const calendar = result.data.user.contributionsCollection.contributionCalendar;
    return {
      totalContributions: calendar.totalContributions,
      heatmap: mapContributionsToHeatmap(calendar.weeks),
    };
  } catch (err) {
    logger.warn("Failed to fetch contribution calendar:", err);
    return null;
  }
}

// ── Public entry point ────────────────────────────────────────────────

export async function searchGitHubUsers(
  query: string,
  signal?: AbortSignal,
): Promise<GitHubSearchResult[]> {
  const search = await ghFetch<GitHubApiSearchResponse>(
    `/search/users?q=${encodeURIComponent(query)}&per_page=5`,
    signal,
  );

  if (search.items.length === 0) return [];

  // Fetch full profiles in parallel for bio/location/company/followers/repos
  const profiles = await Promise.all(
    search.items.map((item) =>
      ghFetch<GitHubApiUser>(`/users/${item.login}`, signal).catch(() => null),
    ),
  );

  return profiles
    .filter((p): p is GitHubApiUser => p !== null)
    .map((user) => ({
      username: user.login,
      name: user.name,
      avatarUrl: user.avatar_url,
      bio: user.bio,
      location: user.location,
      company: user.company,
      repos: user.public_repos,
      followers: user.followers,
    }));
}

export async function fetchGitHubUserData(
  username: string,
  signal?: AbortSignal,
): Promise<GitHubUserData> {
  const [user, rawRepos, events, contributions] = await Promise.all([
    ghFetch<GitHubApiUser>(`/users/${username}`, signal),
    fetchAllRepos(username, signal),
    ghFetch<GitHubApiEvent[]>(
      `/users/${username}/events/public?per_page=100`,
      signal,
    ),
    fetchContributionCalendar(username, signal),
  ]);

  const repositories = rawRepos.map(mapRepo).sort((a, b) => b.stars - a.stars);
  const topRepositories = repositories.slice(0, 6);

  return {
    profile: mapProfile(user),
    repositories,
    topRepositories,
    languages: buildLanguageBreakdown(rawRepos),
    activity: buildActivitySummary(events),
    stats: buildStats(user, rawRepos),
    contributions,
  };
}
