import { RequestHandler } from "express";
import { env } from "../config/env";
import {
  fetchGitHubUserData,
  GitHubError,
} from "../services/github.service";
import { generateAdvice } from "../services/advice.service";
import { buildAdviceData } from "../services/advice-builder.service";
import { USERNAME_RE } from "../lib/validators";
import { sendError, sendSuccess } from "../lib/response";
import { logger } from "../lib/logger";

// String concatenation prevents tsc from statically resolving the import,
// keeping test fixture data out of the production build graph.
const MOCK_AI_PATH = "../../tests/fixtures/" + "mock-ai";

export const adviseUser: RequestHandler = async (req, res) => {
  const username = req.params.username as string;

  if (!USERNAME_RE.test(username)) {
    sendError(res, 400, "Invalid GitHub username format");
    return;
  }

  try {
    if (env.mockAi) {
      const { MOCK_ADVICE_RESPONSE } = await import(MOCK_AI_PATH);
      const githubData = await fetchGitHubUserData(username, req.signal);
      const advice = buildAdviceData(MOCK_ADVICE_RESPONSE, githubData);
      sendSuccess(res, { analyzedName: githubData.profile.name, advice });
      return;
    }

    if (!env.openaiApiKey) {
      sendError(res, 500, "OpenAI API key is not configured");
      return;
    }

    const githubData = await fetchGitHubUserData(username, req.signal);
    const aiAdvice = await generateAdvice(githubData, req.signal);
    const advice = buildAdviceData(aiAdvice, githubData);

    sendSuccess(res, {
      analyzedName: githubData.profile.name,
      advice,
    });
  } catch (err) {
    if (req.signal?.aborted || res.headersSent) return;
    if (err instanceof GitHubError) {
      sendError(res, err.statusCode, err.message);
      return;
    }
    logger.error("Advice error:", err);
    sendError(res, 500, "Advice generation failed. Please try again.");
  }
};
