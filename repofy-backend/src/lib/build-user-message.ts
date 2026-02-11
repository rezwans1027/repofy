import type { GitHubUserData } from "../types";

/**
 * Build a formatted user-message string from GitHub profile data.
 * Used by both the analysis and advice AI services.
 */
export function buildUserMessage(data: GitHubUserData, closingPrompt: string): string {
  const { profile, topRepositories, languages, activity, stats, contributions } = data;

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

  return `
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

${closingPrompt}
`;
}
