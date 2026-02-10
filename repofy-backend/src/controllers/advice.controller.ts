import { RequestHandler } from "express";
import { env } from "../config/env";
import type { GitHubUserData, AIAdviceResponse } from "../types";
import {
  fetchGitHubUserData,
  GitHubError,
  LANGUAGE_COLORS,
  DEFAULT_COLOR,
} from "../services/github.service";
import { generateAdvice } from "../services/advice.service";
import { USERNAME_RE } from "../lib/validators";
import { sendError, sendSuccess } from "../lib/response";
import { logger } from "../lib/logger";

function buildAdviceData(ai: AIAdviceResponse, github: GitHubUserData) {
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

export const adviseUser: RequestHandler = async (req, res) => {
  const username = req.params.username as string;

  if (!USERNAME_RE.test(username)) {
    sendError(res, 400, "Invalid GitHub username format");
    return;
  }

  if (!env.openaiApiKey) {
    sendError(res, 500, "OpenAI API key is not configured");
    return;
  }

  try {
    const githubData = await fetchGitHubUserData(username, req.signal);
    const aiAdvice = await generateAdvice(githubData, req.signal);
    const advice = buildAdviceData(aiAdvice, githubData);

    sendSuccess(res, {
      analyzedName: githubData.profile.name,
      advice,
    });
  } catch (err) {
    if (err instanceof GitHubError) {
      sendError(res, err.statusCode, err.message);
      return;
    }
    logger.error("Advice error:", err);
    sendError(res, 500, "Advice generation failed. Please try again.");
  }
};
