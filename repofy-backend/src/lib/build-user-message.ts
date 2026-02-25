import type { GitHubUserData } from "../types";

/** Max lines per file tree to prevent context bloat. */
const MAX_TREE_LINES = 60;
/** Max characters per code snippet. */
const MAX_SNIPPET_CHARS = 3000;
/** Max total characters for all snapshot blocks combined. */
const MAX_SNAPSHOTS_CHARS = 15000;

/**
 * Build a formatted user-message string from GitHub profile data.
 * Used by both the analysis and advice AI services.
 */
export function buildUserMessage(data: GitHubUserData, closingPrompt: string): string {
  const { profile, topRepositories, languages, activity, stats, contributions, repoSnapshots, aggregateMetrics } = data;

  const repoSummaries = topRepositories.map(
    (r) =>
      `- ${r.name}: ${r.description || "No description"} | ` +
      `Language: ${r.language || "N/A"} | Stars: ${r.stars} | Forks: ${r.forks} | ` +
      `Topics: [${r.topics.join(", ")}] | Fork: ${r.isFork} | Archived: ${r.isArchived} | ` +
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
Signals: hasTests=${s.hasTests} | hasCI=${s.hasCI} | hasLintConfig=${s.hasLintConfig} | hasDockerfile=${s.hasDockerfile} | hasBuildSystem=${s.hasBuildSystem}
readmeWordCount: ${s.readmeWordCount} | releaseCount: ${s.releaseCount} | latestReleaseDaysAgo: ${s.latestReleaseDaysAgo}
contributorCount: ${s.contributorCount} | latestPushDaysAgo: ${s.latestPushDaysAgo}
openIssuesCount: ${s.openIssuesCount} | pullRequestsCount: ${s.pullRequestsCount}
sourceFileCount: ${s.sourceFileCount} | totalLOC: ${s.totalLOC} | maxFileLOC: ${s.maxFileLOC} | largestFilePath: ${s.largestFilePath || "N/A"}
srcDirPresent: ${s.srcDirPresent} | hasReleaseDiscipline: ${s.hasReleaseDiscipline}`;

    if (s.codeSnippets && s.codeSnippets.length > 0) {
      const truncatedSnippets = s.codeSnippets.map((snip) =>
        snip.length > MAX_SNIPPET_CHARS
          ? snip.slice(0, MAX_SNIPPET_CHARS) + "\n... (truncated)"
          : snip,
      );
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

GITHUB PROFILE:
- Username: ${profile.username}
- Name: ${profile.name || "N/A"}
- Bio: ${profile.bio || "N/A"}
- Company: ${profile.company || "N/A"}
- Location: ${profile.location || "N/A"}
- Blog/Website: ${profile.blog || "N/A"}
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
medianLatestPushDaysAgo: ${aggregateMetrics.medianLatestPushDaysAgo}
hasCode: ${aggregateMetrics.hasCode}

${closingPrompt}
`;
}
