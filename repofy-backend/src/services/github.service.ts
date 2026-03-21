/**
 * github.service.ts — GitHub API data fetching and transformation.
 *
 * This file is large but organized into clear functional sections.
 * Natural split points for future refactoring:
 *  1. GitHub API client (fetchJson, graphql, rate-limit handling) → github-client.ts
 *  2. Data transformation (mapUser, mapRepo, buildLanguages) → github-transform.ts
 *  3. Repo snapshot logic (fetchSnapshot, computeAggregateMetrics) → github-snapshots.ts
 *  4. Search endpoint (searchGitHubUsers) → github-search.ts
 *
 * Splitting is deferred because the functions share auth headers, error
 * handling, and type imports — the refactoring overhead outweighs the
 * benefit while the file remains internally well-structured.
 */
import { logger } from "../lib/logger";
import { LANGUAGE_COLORS, DEFAULT_COLOR } from "../lib/language-colors";
import { fetchWithRetry } from "../lib/retry";
import { daysAgo } from "../lib/date-utils";
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
  RepoSnapshot,
  AggregateMetrics,
} from "../types";

// ── File size caps ────────────────────────────────────────────────────

const MAX_README_SIZE_BYTES = 524_288;    // 512 KB
const MAX_SNIPPET_SIZE_BYTES = 262_144;   // 256 KB

// ── Path safety helpers ──────────────────────────────────────────────

/**
 * Normalize and validate a file path from the GitHub tree API before
 * interpolating it into a URL.  Rejects path-traversal attempts (segments
 * containing "..") and URI-encodes each segment so special characters
 * (spaces, #, ?, etc.) don't break the request or escape the path.
 *
 * Returns the sanitized, URI-encoded path string or `null` if the path
 * is unsafe.
 */
function safePath(raw: string): string | null {
  // Normalize: collapse duplicate slashes, trim leading/trailing slashes
  const normalized = raw.replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
  if (!normalized) return null;

  const segments = normalized.split("/");

  // Reject any ".." segment (path traversal)
  if (segments.some((s) => s === "..")) return null;

  // URI-encode each segment individually so "/" separators are preserved
  return segments.map((s) => encodeURIComponent(s)).join("/");
}

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

// ── GitHub API helpers ────────────────────────────────────────────────

const GITHUB_API = "https://api.github.com";
const GITHUB_TIMEOUT_MS = 15_000;

function headers(token: string): Record<string, string> {
  return {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "Repofy",
    Authorization: `Bearer ${token}`,
  };
}

async function ghRequest(url: string, init: RequestInit, signal: AbortSignal | undefined, timeoutMessage: string): Promise<Response> {
  const signals: AbortSignal[] = [AbortSignal.timeout(GITHUB_TIMEOUT_MS)];
  if (signal) signals.push(signal);
  const combined = AbortSignal.any(signals);
  return fetchWithRetry(url, { ...init, signal: combined }, { label: "GitHub", retryableStatuses: [500, 502, 503] }).catch((err) => {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new GitHubError(timeoutMessage, 504);
    }
    throw err;
  });
}

async function ghFetch<T>(path: string, signal: AbortSignal | undefined, token: string): Promise<T> {
  const res = await ghRequest(
    `${GITHUB_API}${path}`,
    { headers: headers(token) },
    signal,
    "GitHub API request timed out",
  );

  if (!res.ok) {
    if (res.status === 401) {
      throw new GitHubError("GitHub token is invalid or revoked. Please re-authenticate.", 401);
    }
    if (res.status === 404) {
      throw new GitHubError("User not found", 404);
    }
    if (res.status === 403 || res.status === 429) {
      throw new GitHubError(
        "GitHub API rate limit exceeded. Try again later.",
        429,
      );
    }
    throw new GitHubError(`GitHub API error: ${res.status}`, res.status);
  }

  return res.json() as Promise<T>;
}

/** Fetch with response object to inspect headers (e.g. Link header for pagination counts). */
async function ghFetchRaw(path: string, signal: AbortSignal | undefined, token: string): Promise<Response> {
  return ghRequest(
    `${GITHUB_API}${path}`,
    { headers: headers(token) },
    signal,
    "GitHub API request timed out",
  );
}

// ── GitHub GraphQL API helper ─────────────────────────────────────────

const GITHUB_GRAPHQL = "https://api.github.com/graphql";

async function ghGraphQL<T>(query: string, variables: Record<string, unknown> | undefined, signal: AbortSignal | undefined, token: string): Promise<T> {
  const res = await ghRequest(
    GITHUB_GRAPHQL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "Repofy",
      },
      body: JSON.stringify({ query, variables }),
    },
    signal,
    "GitHub GraphQL request timed out",
  );
  if (!res.ok) throw new GitHubError(`GitHub GraphQL error: ${res.status}`, res.status);
  const json = await res.json() as T & { errors?: { message: string }[] };
  if (json.errors?.length) {
    throw new GitHubError(`GitHub GraphQL: ${json.errors[0].message}`, 422);
  }
  return json;
}

// ── Paginated repo fetch ──────────────────────────────────────────────

const MAX_REPO_PAGES = 10; // Cap at 1000 repos max

async function fetchAllRepos(username: string, signal: AbortSignal | undefined, token: string): Promise<GitHubApiRepo[]> {
  // Fetch first page with headers to determine total page count
  const firstRes = await ghFetchRaw(
    `/users/${username}/repos?per_page=100&page=1&sort=updated`,
    signal,
    token,
  );
  if (!firstRes.ok) {
    if (firstRes.status === 404) throw new GitHubError("User not found", 404);
    if (firstRes.status === 403 || firstRes.status === 429) {
      throw new GitHubError("GitHub API rate limit exceeded. Try again later.", 429);
    }
    throw new GitHubError(`GitHub API error: ${firstRes.status}`, firstRes.status);
  }

  const firstBatch = await firstRes.json() as GitHubApiRepo[];
  if (firstBatch.length < 100) return firstBatch;

  // Determine remaining pages from Link header
  const linkHeader = firstRes.headers.get("link");
  let lastPage = MAX_REPO_PAGES;
  if (linkHeader) {
    const match = linkHeader.match(/[&?]page=(\d+)>;\s*rel="last"/);
    if (match) lastPage = Math.min(parseInt(match[1], 10), MAX_REPO_PAGES);
  }

  // Fetch remaining pages in parallel
  const pages = Array.from({ length: lastPage - 1 }, (_, i) => i + 2);
  const batches = await Promise.all(
    pages.map((page) =>
      ghFetch<GitHubApiRepo[]>(
        `/users/${username}/repos?per_page=100&page=${page}&sort=updated`,
        signal,
        token,
      ).catch(() => [] as GitHubApiRepo[]),
    ),
  );

  return [...firstBatch, ...batches.flat()];
}

// ── Pinned repos (GraphQL) ────────────────────────────────────────────

const PINNED_REPOS_QUERY = `
  query($username: String!) {
    user(login: $username) {
      pinnedItems(first: 6, types: REPOSITORY) {
        nodes {
          ... on Repository {
            name
          }
        }
      }
    }
  }
`;

interface GQLPinnedResponse {
  data: {
    user: {
      pinnedItems: {
        nodes: { name: string }[];
      };
    };
  };
}

async function fetchPinnedRepoNames(username: string, signal: AbortSignal | undefined, token: string): Promise<string[]> {
  try {
    const result = await ghGraphQL<GQLPinnedResponse>(
      PINNED_REPOS_QUERY,
      { username },
      signal,
      token,
    );
    const nodes = result?.data?.user?.pinnedItems?.nodes;
    if (!Array.isArray(nodes)) return [];
    return nodes.filter((n) => n && typeof n.name === "string").map((n) => n.name);
  } catch (err) {
    logger.warn("Failed to fetch pinned repos:", err);
    return [];
  }
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
      color: (LANGUAGE_COLORS as Record<string, string>)[name] || DEFAULT_COLOR,
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
  reposTruncated: boolean,
): GitHubStats {
  let totalStars = 0;
  let totalForks = 0;
  let originalRepos = 0;

  for (const repo of repos) {
    totalStars += repo.stargazers_count;
    totalForks += repo.forks_count;
    if (!repo.fork) originalRepos++;
  }

  const accountAgeDays = daysAgo(user.created_at);

  return { totalStars, totalForks, originalRepos, accountAgeDays, reposTruncated };
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
  signal: AbortSignal | undefined,
  token: string,
): Promise<ContributionCalendar | null> {
  try {
    const result = await ghGraphQL<GQLContributionResponse>(
      CONTRIBUTION_QUERY,
      { username },
      signal,
      token,
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

// ── Top-repo selection (pinned first, then stars) ─────────────────────

function selectTopRepos(
  allRepos: GitHubRepo[],
  pinnedNames: string[],
): GitHubRepo[] {
  const selected: GitHubRepo[] = [];
  const used = new Set<string>();

  // 1. Pinned repos first (in pinned order)
  for (const name of pinnedNames) {
    const repo = allRepos.find((r) => r.name === name);
    if (repo && !used.has(repo.name)) {
      selected.push(repo);
      used.add(repo.name);
    }
  }

  // 2. Then highest-star non-fork repos, excluding archived unless pinned
  const candidates = allRepos
    .filter((r) => !used.has(r.name) && !r.isFork && !r.isArchived)
    .sort((a, b) => b.stars - a.stars);

  for (const repo of candidates) {
    if (selected.length >= 6) break;
    selected.push(repo);
    used.add(repo.name);
  }

  return selected.slice(0, 6);
}

// ── Concurrency limiter ───────────────────────────────────────────

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await fn(items[idx]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

// ── Repo snapshot fetching ────────────────────────────────────────────

const SOURCE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".pyx",
  ".rs",
  ".go",
  ".java", ".kt", ".kts",
  ".c", ".h", ".cpp", ".hpp", ".cc",
  ".cs",
  ".rb",
  ".php",
  ".swift",
  ".dart",
  ".scala",
  ".ex", ".exs",
  ".hs",
  ".lua",
  ".zig",
  ".ml", ".mli",
  ".r",
  ".vue", ".svelte",
]);

const ENTRY_FILE_NAMES = [
  "index.ts", "index.tsx", "index.js", "index.jsx",
  "main.ts", "main.tsx", "main.js", "main.jsx",
  "app.ts", "app.tsx", "app.js", "app.jsx",
  "main.py", "app.py", "__main__.py",
  "main.go", "cmd/main.go",
  "main.rs", "src/main.rs", "src/lib.rs",
  "Main.java",
  "Program.cs",
  "main.rb", "app.rb",
];

interface GitTreeEntry {
  path: string;
  type: "blob" | "tree";
  size?: number;
}

interface GitTreeResponse {
  tree: GitTreeEntry[];
  truncated: boolean;
}

function buildTreeString(entries: GitTreeEntry[], maxDepth: number): string {
  const lines: string[] = [];
  for (const entry of entries) {
    const depth = entry.path.split("/").length - 1;
    if (depth > maxDepth) continue;
    const indent = "  ".repeat(depth);
    const name = entry.path.split("/").pop() || entry.path;
    const suffix = entry.type === "tree" ? "/" : "";
    lines.push(`${indent}${name}${suffix}`);
  }
  return lines.slice(0, 100).join("\n"); // cap at 100 lines
}

function isTestPath(p: string, filename: string, hasGitStyleTests: boolean): boolean {
  return (
    p === "test" || p.startsWith("test/") || p.includes("/test/") ||
    p === "tests" || p.startsWith("tests/") || p.includes("/tests/") ||
    p === "__tests__" || p.startsWith("__tests__/") || p.includes("/__tests__/") ||
    filename.includes(".test.") || filename.includes(".spec.") || filename.includes("_test.") ||
    p.startsWith("selftests/") || p.includes("/selftests/") ||
    p.startsWith("selftest/") || p.includes("/selftest/") ||
    p.includes("tools/testing/") ||
    ((p === "t" || p.startsWith("t/")) && hasGitStyleTests) ||
    filename === "tox.ini" || filename === "pytest.ini" || filename === "conftest.py"
  );
}

function isCIPath(p: string): boolean {
  return (
    p.includes(".github/workflows/") || p.includes(".circleci/") ||
    p === "jenkinsfile" || p === ".travis.yml" || p === ".gitlab-ci.yml" ||
    p.includes(".buildkite/") || p === "azure-pipelines.yml" ||
    p === "appveyor.yml" || p === ".appveyor.yml" ||
    p === "cloudbuild.yaml" || p === "cloudbuild.json" ||
    p === ".drone.yml" || p === "bitbucket-pipelines.yml" ||
    p === "taskcluster.yml" || p.includes(".taskcluster/")
  );
}

function isLintConfigFile(p: string, filename: string): boolean {
  return (
    filename.startsWith(".eslintrc") ||
    filename.startsWith(".prettierrc") || filename === "prettier.config.js" || filename === "prettier.config.cjs" ||
    filename === "biome.json" || filename === "biome.jsonc" ||
    filename === ".flake8" || filename === "setup.cfg" || filename === "ruff.toml" ||
    filename === "eslint.config.js" || filename === "eslint.config.mjs" || filename === "eslint.config.ts" ||
    filename === ".clang-format" || filename === ".clang-tidy" || filename === ".editorconfig" ||
    filename === "checkpatch.pl" || p.includes("scripts/checkpatch") ||
    filename === ".pylintrc" || filename === "pyproject.toml" || filename === "mypy.ini" || filename === ".mypy.ini" ||
    filename === ".rubocop.yml" ||
    filename === ".golangci.yml" || filename === ".golangci.yaml" ||
    filename === "rustfmt.toml" || filename === ".rustfmt.toml" || filename === "clippy.toml"
  );
}

function isDockerPath(p: string): boolean {
  return (
    p === "dockerfile" || p.startsWith("dockerfile.") ||
    p === "docker-compose.yml" || p === "docker-compose.yaml" ||
    p.startsWith("docker-compose.")
  );
}

function isBuildSystemFile(filename: string, hasBazelCoIndicator: boolean): boolean {
  return (
    filename === "makefile" || filename === "gnumakefile" || filename === "cmakelists.txt" || filename === "meson.build" ||
    filename === "build.gradle" || filename === "build.gradle.kts" || filename === "pom.xml" || filename === "build.zig" ||
    filename === ".bazelrc" || filename === "build.bazel" || (filename === "workspace" && hasBazelCoIndicator) ||
    filename === "configure.ac" ||
    filename === "kbuild" || filename === "kconfig"
  );
}

export function detectSignals(entries: GitTreeEntry[]) {
  let hasTests = false;
  let hasCI = false;
  let hasLintConfig = false;
  let hasDockerfile = false;
  let hasBuildSystem = false;
  let srcDirPresent = false;
  let sourceFileCount = 0;
  let totalLOC = 0;
  let maxFileLOC = 0;
  let largestFilePath = "";

  // Pre-compute co-indicator lookups to avoid O(n²) inner scans
  const hasGitStyleTests = entries.some((e) => /^t\/t\d/i.test(e.path));
  const hasBazelCoIndicator = entries.some((e) => {
    const lp = e.path.toLowerCase();
    return lp.endsWith(".bazelrc") || lp.endsWith("build.bazel");
  });

  for (const entry of entries) {
    const p = entry.path.toLowerCase();
    const filename = p.split("/").pop() || p;

    if (!hasTests && isTestPath(p, filename, hasGitStyleTests)) hasTests = true;
    if (!hasCI && isCIPath(p)) hasCI = true;
    if (!hasLintConfig && isLintConfigFile(p, filename)) hasLintConfig = true;
    if (!hasDockerfile && isDockerPath(p)) hasDockerfile = true;
    if (!hasBuildSystem && isBuildSystemFile(filename, hasBazelCoIndicator)) hasBuildSystem = true;
    if (!srcDirPresent && (p === "src" || p.startsWith("src/"))) srcDirPresent = true;

    // Source file count and LOC estimation
    if (entry.type === "blob") {
      const ext = "." + (p.split(".").pop() || "");
      if (SOURCE_EXTENSIONS.has(ext)) {
        sourceFileCount++;
        const estimatedLOC = entry.size ? Math.round(entry.size / 40) : 0;
        totalLOC += estimatedLOC;
        if (estimatedLOC > maxFileLOC) {
          maxFileLOC = estimatedLOC;
          largestFilePath = entry.path;
        }
      }
    }
  }

  return {
    hasTests, hasCI, hasLintConfig, hasDockerfile, hasBuildSystem, srcDirPresent,
    sourceFileCount, totalLOC, maxFileLOC, largestFilePath,
  };
}

function computeReleaseMetrics(
  releases: { tag_name: string; published_at: string }[],
): { releaseCount: number; latestReleaseDaysAgo: number } {
  const releaseCount = releases.length;
  let latestReleaseDaysAgo = Infinity;
  if (releases.length > 0 && releases[0].published_at) {
    latestReleaseDaysAgo = daysAgo(releases[0].published_at);
  }
  return { releaseCount, latestReleaseDaysAgo };
}

async function extractContributorCount(response: Response | null): Promise<number> {
  let contributorCount = 1;
  if (response && response.ok) {
    const linkHeader = response.headers.get("link");
    if (linkHeader) {
      contributorCount = parseLinkHeaderCount(linkHeader, 1) || 1;
    }
    try {
      const contribs = await response.json() as unknown[];
      if (Array.isArray(contribs)) {
        contributorCount = Math.max(contribs.length, contributorCount);
      }
    } catch { /* ignore */ }
  }
  return contributorCount;
}

async function extractPullRequestCount(response: Response | null): Promise<number> {
  let pullRequestsCount = 0;
  if (response && response.ok) {
    const linkHeader = response.headers.get("link");
    if (linkHeader) {
      pullRequestsCount = parseLinkHeaderCount(linkHeader, 1);
    } else {
      try {
        const pulls = await response.json() as unknown[];
        if (Array.isArray(pulls)) pullRequestsCount = pulls.length;
      } catch { /* ignore */ }
    }
  }
  return pullRequestsCount;
}

/** Extract total count from GitHub Link header (last page). */
function parseLinkHeaderCount(linkHeader: string | null, perPage: number): number {
  if (!linkHeader) return 0;
  const match = linkHeader.match(/[&?]page=(\d+)>;\s*rel="last"/);
  if (match) return parseInt(match[1], 10) * perPage;
  return 0;
}

async function fetchRepoSnapshot(
  username: string,
  repo: GitHubRepo,
  fetchSnippets: boolean,
  signal: AbortSignal | undefined,
  token: string,
): Promise<RepoSnapshot> {
  const defaultBranch = "HEAD"; // GitHub trees API resolves HEAD

  try {
    // Parallel fetches for this repo
    const encodedRepoName = encodeURIComponent(repo.name);
    const [treeResult, releasesResult, contributorsResult, pullsResult] = await Promise.all([
      // 1. File tree
      ghFetch<GitTreeResponse>(
        `/repos/${username}/${encodedRepoName}/git/trees/${defaultBranch}?recursive=1`,
        signal,
        token,
      ).catch(() => null),
      // 2. Releases
      ghFetch<{ tag_name: string; published_at: string }[]>(
        `/repos/${username}/${encodedRepoName}/releases?per_page=5`,
        signal,
        token,
      ).catch(() => []),
      // 3. Contributors (just need count from Link header)
      ghFetchRaw(
        `/repos/${username}/${encodedRepoName}/contributors?per_page=1&anon=true`,
        signal,
        token,
      ).catch(() => null),
      // 4. Pull requests count from Link header
      ghFetchRaw(
        `/repos/${username}/${encodedRepoName}/pulls?state=all&per_page=1`,
        signal,
        token,
      ).catch(() => null),
    ]);

    // Process tree
    const entries = treeResult?.tree ?? [];
    const tree = buildTreeString(entries, 3);
    const signals = detectSignals(entries);

    // README word count
    let readmeWordCount = 0;
    const readmeEntry = entries.find(
      (e) => e.type === "blob" && /^readme\.md$/i.test(e.path),
    );
    if (readmeEntry) {
      // Skip fetch entirely if the tree reports the file is too large
      if (readmeEntry.size !== undefined && readmeEntry.size > MAX_README_SIZE_BYTES) {
        readmeWordCount = 0; // README too large, skip
      } else {
        const safeReadmePath = safePath(readmeEntry.path);
        if (!safeReadmePath) {
          logger.warn(`Skipping README with unsafe path: ${readmeEntry.path}`);
        } else {
          try {
            const readmeData = await ghFetch<{ content: string; encoding: string }>(
              `/repos/${username}/${encodedRepoName}/contents/${safeReadmePath}`,
              signal,
              token,
            );
            if (readmeData.encoding === "base64") {
              const text = Buffer.from(readmeData.content, "base64")
                .toString("utf-8")
                .slice(0, MAX_README_SIZE_BYTES);
              readmeWordCount = text.split(/\s+/).filter(Boolean).length;
            }
          } catch {
            // Non-critical
          }
        }
      }
    }

    // Releases
    const { releaseCount, latestReleaseDaysAgo } = computeReleaseMetrics(releasesResult ?? []);

    // Contributors count
    const contributorCount = await extractContributorCount(contributorsResult);

    // Pull requests count
    const pullRequestsCount = await extractPullRequestCount(pullsResult);

    // Computed fields
    const latestPushDaysAgo = daysAgo(repo.pushedAt);
    const hasReleaseDiscipline = releaseCount >= 2 && latestReleaseDaysAgo <= 365;

    // Code snippets (only for top repos)
    let codeSnippets: string[] | undefined;
    if (fetchSnippets && entries.length > 0) {
      codeSnippets = await fetchCodeSnippets(username, repo.name, entries, signal, token);
    }

    return {
      name: repo.name,
      fileTree: tree,
      hasTests: signals.hasTests,
      hasCI: signals.hasCI,
      hasLintConfig: signals.hasLintConfig,
      hasDockerfile: signals.hasDockerfile,
      hasBuildSystem: signals.hasBuildSystem,
      readmeWordCount,
      releaseCount,
      latestReleaseDaysAgo: latestReleaseDaysAgo === Infinity ? -1 : latestReleaseDaysAgo,
      contributorCount,
      latestPushDaysAgo,
      openIssuesCount: repo.openIssues,
      pullRequestsCount,
      sourceFileCount: signals.sourceFileCount,
      totalLOC: signals.totalLOC,
      maxFileLOC: signals.maxFileLOC,
      largestFilePath: signals.largestFilePath,
      srcDirPresent: signals.srcDirPresent,
      hasReleaseDiscipline,
      codeSnippets,
    };
  } catch (err) {
    logger.warn(`Failed to fetch snapshot for ${repo.name}:`, err);
    return {
      name: repo.name,
      fileTree: "",
      hasTests: false,
      hasCI: false,
      hasLintConfig: false,
      hasDockerfile: false,
      hasBuildSystem: false,
      readmeWordCount: 0,
      releaseCount: 0,
      latestReleaseDaysAgo: -1,
      contributorCount: 0,
      latestPushDaysAgo: daysAgo(repo.pushedAt),
      openIssuesCount: repo.openIssues,
      pullRequestsCount: 0,
      sourceFileCount: 0,
      totalLOC: 0,
      maxFileLOC: 0,
      largestFilePath: "",
      srcDirPresent: false,
      hasReleaseDiscipline: false,
    };
  }
}

async function fetchCodeSnippets(
  username: string,
  repoName: string,
  entries: GitTreeEntry[],
  signal: AbortSignal | undefined,
  token: string,
): Promise<string[]> {
  const snippets: string[] = [];
  const MAX_SNIPPET_LINES = 250;

  // Find entry file (skip files that are too large)
  const entryPath = ENTRY_FILE_NAMES.find((name) =>
    entries.some(
      (e) =>
        e.type === "blob" &&
        e.path.toLowerCase() === name.toLowerCase() &&
        !(e.size !== undefined && e.size > MAX_SNIPPET_SIZE_BYTES),
    ),
  );

  // Find test file (skip files that are too large)
  const testEntry = entries.find(
    (e) =>
      e.type === "blob" &&
      (e.path.includes(".test.") || e.path.includes(".spec.") || e.path.includes("_test.")) &&
      !(e.size !== undefined && e.size > MAX_SNIPPET_SIZE_BYTES),
  );

  const filesToFetch: string[] = [];
  if (entryPath) {
    const actual = entries.find(
      (e) =>
        e.type === "blob" &&
        e.path.toLowerCase() === entryPath.toLowerCase() &&
        !(e.size !== undefined && e.size > MAX_SNIPPET_SIZE_BYTES),
    );
    if (actual) filesToFetch.push(actual.path);
  }
  if (testEntry) filesToFetch.push(testEntry.path);

  const encodedRepo = encodeURIComponent(repoName);
  const results = await Promise.allSettled(
    filesToFetch.slice(0, 2).map(async (filePath) => {
      const encodedPath = safePath(filePath);
      if (!encodedPath) {
        logger.warn(`Skipping snippet with unsafe path: ${filePath}`);
        return null;
      }
      const fileData = await ghFetch<{ content: string; encoding: string }>(
        `/repos/${username}/${encodedRepo}/contents/${encodedPath}`,
        signal,
        token,
      );
      if (fileData.encoding === "base64") {
        const text = Buffer.from(fileData.content, "base64")
          .toString("utf-8")
          .slice(0, MAX_SNIPPET_SIZE_BYTES);
        const lines = text.split("\n").slice(0, MAX_SNIPPET_LINES);
        return `--- ${filePath} ---\n${lines.join("\n")}`;
      }
      return null;
    }),
  );
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) snippets.push(r.value);
  }

  return snippets;
}

function computeAggregateMetrics(snapshots: RepoSnapshot[]): AggregateMetrics {
  const pushDays = snapshots
    .map((s) => s.latestPushDaysAgo)
    .filter((d) => d >= 0)
    .sort((a, b) => a - b);

  const medianLatestPushDaysAgo =
    pushDays.length > 0
      ? pushDays[Math.floor(pushDays.length / 2)]
      : 0;

  const totalSourceFiles = snapshots.reduce((sum, s) => sum + s.sourceFileCount, 0);
  const totalLOC = snapshots.reduce((sum, s) => sum + s.totalLOC, 0);
  const hasCode = totalSourceFiles >= 3 || totalLOC >= 300;

  return { medianLatestPushDaysAgo, hasCode };
}

// ── Service-level user data cache ─────────────────────────────────────
//
// Deduplicates GitHub API calls when the same user is fetched by
// multiple controllers (analyze, advice, github) within a short window.
// The controller-level cache in github.controller.ts is coarser (5 min,
// 128 entries); this one is tighter (3 min, 64 entries) and sits closer
// to the network boundary so *all* callers benefit.

const USER_DATA_CACHE_TTL = 3 * 60 * 1000; // 3 minutes
const USER_DATA_CACHE_MAX = 64;

interface UserDataCacheEntry {
  data: GitHubUserData;
  timestamp: number;
}

const userDataCache = new Map<string, UserDataCacheEntry>();

/** Clear the service-level user data cache. Exposed for test isolation. */
export function clearUserDataCache(): void {
  userDataCache.clear();
}

// ── Public entry point ────────────────────────────────────────────────

export async function searchGitHubUsers(
  query: string,
  signal: AbortSignal | undefined,
  token: string,
): Promise<GitHubSearchResult[]> {
  const search = await ghFetch<GitHubApiSearchResponse>(
    `/search/users?q=${encodeURIComponent(query)}&per_page=5`,
    signal,
    token,
  );

  if (search.items.length === 0) return [];

  // Fetch full profiles in parallel for bio/location/company/followers/repos
  const profiles = await Promise.all(
    search.items.map((item) =>
      ghFetch<GitHubApiUser>(`/users/${item.login}`, signal, token).catch(() => null),
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
  signal: AbortSignal | undefined,
  token: string,
): Promise<GitHubUserData> {
  const cacheKey = username.toLowerCase();

  // Check cache
  const cached = userDataCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < USER_DATA_CACHE_TTL) {
    return cached.data;
  }
  // Remove stale entry
  if (cached) userDataCache.delete(cacheKey);

  const data = await fetchGitHubUserDataUncached(username, signal, token);

  // Evict oldest entry when cache is full
  if (userDataCache.size >= USER_DATA_CACHE_MAX) {
    const oldest = userDataCache.keys().next().value;
    if (oldest !== undefined) userDataCache.delete(oldest);
  }
  userDataCache.set(cacheKey, { data, timestamp: Date.now() });

  return data;
}

async function fetchGitHubUserDataUncached(
  username: string,
  signal: AbortSignal | undefined,
  token: string,
): Promise<GitHubUserData> {
  const [user, rawRepos, events, contributions, pinnedNames] = await Promise.all([
    ghFetch<GitHubApiUser>(`/users/${username}`, signal, token),
    fetchAllRepos(username, signal, token),
    ghFetch<GitHubApiEvent[]>(
      `/users/${username}/events/public?per_page=100`,
      signal,
      token,
    ),
    fetchContributionCalendar(username, signal, token),
    fetchPinnedRepoNames(username, signal, token),
  ]);

  const truncated = rawRepos.length < user.public_repos;
  const repositories = rawRepos.map(mapRepo).sort((a, b) => b.stars - a.stars);
  const topRepositories = selectTopRepos(repositories, pinnedNames);

  // Fetch repo snapshots (top 3 by stars get code snippets)
  const topByStars = [...topRepositories].sort((a, b) => b.stars - a.stars);
  const top3Names = new Set(topByStars.slice(0, 3).map((r) => r.name));

  const repoSnapshots = await mapWithConcurrency(
    topRepositories,
    3,
    (repo) => fetchRepoSnapshot(username, repo, top3Names.has(repo.name), signal, token),
  );

  const aggregateMetrics = computeAggregateMetrics(repoSnapshots);

  return {
    profile: mapProfile(user),
    repositories,
    topRepositories,
    languages: buildLanguageBreakdown(rawRepos),
    activity: buildActivitySummary(events),
    stats: buildStats(user, rawRepos, truncated),
    contributions,
    repoSnapshots,
    aggregateMetrics,
  };
}
