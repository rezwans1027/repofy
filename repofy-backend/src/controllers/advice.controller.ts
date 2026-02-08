import { RequestHandler } from "express";
import { env } from "../config/env";
import type { ApiResponse, GitHubUserData, AIAdviceResponse } from "../types";
import {
  fetchGitHubUserData,
  GitHubError,
  LANGUAGE_COLORS,
  DEFAULT_COLOR,
} from "../services/github.service";
import { generateAdvice } from "../services/advice.service";

const USERNAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;

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
    const response: ApiResponse = {
      success: false,
      error: "Invalid GitHub username format",
    };
    res.status(400).json(response);
    return;
  }

  if (!env.openaiApiKey) {
    const response: ApiResponse = {
      success: false,
      error: "OpenAI API key is not configured",
    };
    res.status(503).json(response);
    return;
  }

  try {
    const githubData = await fetchGitHubUserData(username);
    const aiAdvice = await generateAdvice(githubData);
    const advice = buildAdviceData(aiAdvice, githubData);

    const response: ApiResponse = {
      success: true,
      data: {
        analyzedName: githubData.profile.name,
        advice,
      },
    };
    res.json(response);
  } catch (err) {
    if (err instanceof GitHubError) {
      const response: ApiResponse = {
        success: false,
        error: err.message,
      };
      res.status(err.statusCode).json(response);
      return;
    }
    console.error("[Repofy] Advice error:", err);
    const response: ApiResponse = {
      success: false,
      error: "Advice generation failed. Please try again.",
    };
    res.status(500).json(response);
  }
};
