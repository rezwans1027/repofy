import type { GitHubUserData } from "../types";
import { sanitizeForPrompt } from "./sanitize-prompt";

/** Max lines per file tree to prevent context bloat. */
const MAX_TREE_LINES = 60;
/** Max characters per code snippet. */
const MAX_SNIPPET_CHARS = 3000;
/** Max total characters for all snapshot blocks combined. */
const MAX_SNAPSHOTS_CHARS = 15000;

const USER_DATA_BEGIN = "===BEGIN USER-PROVIDED DATA===";
const USER_DATA_END = "===END USER-PROVIDED DATA===";

/**
 * Build a formatted user-message string from GitHub profile data.
 * Used by both the analysis and advice AI services.
 */
export function buildUserMessage(data: GitHubUserData, closingPrompt: string): string {
  const { profile, topRepositories, languages, activity, stats, contributions, repoSnapshots, aggregateMetrics } = data;

  // Sanitise user-controlled profile fields
  const safeName = sanitizeForPrompt(profile.name, 100);
  const safeBio = sanitizeForPrompt(profile.bio, 300);
  const safeCompany = sanitizeForPrompt(profile.company, 100);
  const safeLocation = sanitizeForPrompt(profile.location, 100);
  const safeBlog = sanitizeForPrompt(profile.blog, 200);

  const repoSummaries = topRepositories.map(
    (r) =>
      `- ${r.name}: ${sanitizeForPrompt(r.description, 200) || "No description"} | ` +
      `Language: ${r.language || "N/A"} | Stars: ${r.stars} | Forks: ${r.forks} | ` +
      `Topics: [${r.topics.map((t) => sanitizeForPrompt(t, 50)).join(", ")}] | Fork: ${r.isFork} | Archived: ${r.isArchived} | ` +
      `Last pushed: ${r.pushedAt}`,
  );

  const langSummary = languages
    .slice(0, 8)
    .map((l) => `${l.name}: ${l.percentage}% (${l.repoCount} repos)`)
    .join(", ");

  // Repo snapshot blocks (with size budgets)
  const snapshotParts = repoSnapshots.map((s) => {
    // Truncate file tree to MAX_TREE_LINES
    const treeLines = (s.fileTree || "").split("\n");
    const truncatedTree = treeLines.length > MAX_TREE_LINES
      ? treeLines.slice(0, MAX_TREE_LINES).join("\n") + `\n... (${treeLines.length - MAX_TREE_LINES} more entries)`
      : s.fileTree || "(empty or unavailable)";

    let block = `
REPO SNAPSHOT: ${s.name}
File Tree:
${truncatedTree}
Has tests: ${s.hasTests ? "yes" : "no"} | Has CI: ${s.hasCI ? "yes" : "no"} | Has lint config: ${s.hasLintConfig ? "yes" : "no"} | Has Dockerfile: ${s.hasDockerfile ? "yes" : "no"} | Has build system: ${s.hasBuildSystem ? "yes" : "no"}
README word count: ${s.readmeWordCount} | Releases: ${s.releaseCount} | Latest release: ${s.latestReleaseDaysAgo} days ago
Contributors: ${s.contributorCount} | Last pushed: ${s.latestPushDaysAgo} days ago
Open issues: ${s.openIssuesCount} | Pull requests: ${s.pullRequestsCount}
Source files: ${s.sourceFileCount} | Total lines of code: ${s.totalLOC} | Largest file: ${s.maxFileLOC} lines (${s.largestFilePath || "N/A"})
Has src/ directory: ${s.srcDirPresent ? "yes" : "no"} | Has release discipline: ${s.hasReleaseDiscipline ? "yes" : "no"}`;

    if (s.codeSnippets && s.codeSnippets.length > 0) {
      const truncatedSnippets = s.codeSnippets.map((snip) => {
        const cleaned = sanitizeForPrompt(snip, MAX_SNIPPET_CHARS);
        return cleaned;
      });
      block += `\n\nCODE SNIPPETS (${s.name}):\n${truncatedSnippets.join("\n\n")}`;
    }

    return block;
  });

  // Enforce total snapshots budget
  let snapshotBlocks = snapshotParts.join("\n");
  if (snapshotBlocks.length > MAX_SNAPSHOTS_CHARS) {
    snapshotBlocks = snapshotBlocks.slice(0, MAX_SNAPSHOTS_CHARS) + "\n... (snapshot data truncated for context budget)";
  }

  return `
REPO SELECTION: These repositories were selected as: (1) Pinned repos first, (2) Then highest-star non-fork repos, (3) Archived repos excluded unless pinned.

${USER_DATA_BEGIN}
GITHUB PROFILE:
- Username: ${profile.username}
- Name: ${safeName}
- Bio: ${safeBio}
- Company: ${safeCompany}
- Location: ${safeLocation}
- Blog/Website: ${safeBlog}
- Public repos: ${profile.publicRepos}
- Followers: ${profile.followers} | Following: ${profile.following}
- Account created: ${profile.createdAt}

STATS:
- Total stars: ${stats.totalStars}${stats.reposTruncated ? " (based on first 1000 repos — actual total may be higher)" : ""}
- Total forks: ${stats.totalForks}${stats.reposTruncated ? " (truncated)" : ""}
- Original repos (non-fork): ${stats.originalRepos}
- Account age: ${stats.accountAgeDays} days
- Total contributions (last year): ${contributions?.totalContributions ?? "N/A"}
- Repo data truncated: ${stats.reposTruncated ? "Yes — user has more than 1000 repos; stats are approximate" : "No"}

TOP REPOSITORIES (up to 6):
${repoSummaries.join("\n")}

LANGUAGES: ${langSummary}

RECENT ACTIVITY (last 100 events):
- Total events: ${activity.totalEvents}
- Push events: ${activity.pushEvents}
- PR events: ${activity.prEvents}
- Issue events: ${activity.issueEvents}
- Review events: ${activity.reviewEvents}
- Recently active repos: ${activity.recentActiveRepos.slice(0, 5).join(", ")}
${snapshotBlocks}

AGGREGATE METRICS:
Median days since last push: ${aggregateMetrics.medianLatestPushDaysAgo}
Has code: ${aggregateMetrics.hasCode ? "yes" : "no"}
${USER_DATA_END}

${closingPrompt}
`;
}
