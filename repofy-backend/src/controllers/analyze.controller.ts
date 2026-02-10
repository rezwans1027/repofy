import { RequestHandler } from "express";
import { env } from "../config/env";
import { fetchGitHubUserData, GitHubError } from "../services/github.service";
import { generateAnalysis } from "../services/openai.service";
import { buildReportData } from "../services/analyze.service";
import { USERNAME_RE } from "../lib/validators";
import { sendError, sendSuccess } from "../lib/response";
import { logger } from "../lib/logger";

export const analyzeUser: RequestHandler = async (req, res) => {
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
    const aiAnalysis = await generateAnalysis(githubData, req.signal);
    const report = buildReportData(aiAnalysis, githubData);

    sendSuccess(res, {
      analyzedName: githubData.profile.name,
      report,
    });
  } catch (err) {
    if (req.signal?.aborted || res.headersSent) return;
    if (err instanceof GitHubError) {
      sendError(res, err.statusCode, err.message);
      return;
    }
    logger.error("Analysis error:", err);
    sendError(res, 500, "Analysis failed. Please try again.");
  }
};
