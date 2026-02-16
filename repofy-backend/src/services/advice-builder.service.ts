import type { GitHubUserData, AIAdviceResponse } from "../types";
import { LANGUAGE_COLORS, DEFAULT_COLOR } from "./github.service";

/**
 * Merge AI advice with GitHub repo data to enrich repo improvements
 * with URLs, language colors, and star counts.
 */
export function buildAdviceData(ai: AIAdviceResponse, github: GitHubUserData) {
  const { topRepositories } = github;

  // Enrich repo improvements with URLs and language colors
  const repoImprovements = ai.repoImprovements.map((repo) => {
    const ghRepo = topRepositories.find(
      (r) => r.name.toLowerCase() === repo.repoName.toLowerCase(),
    );
    return {
      repoName: repo.repoName,
      repoUrl: ghRepo?.url ?? null,
      language: ghRepo?.language ?? null,
      languageColor: ghRepo?.language
        ? LANGUAGE_COLORS[ghRepo.language] || DEFAULT_COLOR
        : DEFAULT_COLOR,
      stars: ghRepo?.stars ?? 0,
      improvements: repo.improvements,
    };
  });

  return {
    summary: ai.summary,
    projectIdeas: ai.projectIdeas,
    repoImprovements,
    skillsToLearn: ai.skillsToLearn,
    contributionAdvice: ai.contributionAdvice,
    profileOptimizations: ai.profileOptimizations,
    actionPlan: ai.actionPlan,
  };
}
