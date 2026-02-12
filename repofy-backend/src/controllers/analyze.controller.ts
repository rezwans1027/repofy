import { RequestHandler } from "express";
import { env } from "../config/env";
import { fetchGitHubUserData, GitHubError } from "../services/github.service";
import { generateAnalysis } from "../services/openai.service";
import { buildReportData } from "../services/analyze.service";
import { USERNAME_RE } from "../lib/validators";
import { sendError, sendSuccess } from "../lib/response";
import { logger } from "../lib/logger";

// String concatenation prevents tsc from statically resolving the import,
// keeping test fixture data out of the production build graph.
const MOCK_AI_PATH = "../../tests/fixtures/" + "mock-ai";

export const analyzeUser: RequestHandler = async (req, res) => {
  const username = req.params.username as string;

  if (!USERNAME_RE.test(username)) {
    sendError(res, 400, "Invalid GitHub username format");
    return;
  }

  try {
    if (env.mockAi) {
      const { MOCK_ANALYSIS_RESPONSE } = await import(MOCK_AI_PATH);
      const githubData = await fetchGitHubUserData(username, req.signal);
      const report = buildReportData(MOCK_ANALYSIS_RESPONSE, githubData);
      sendSuccess(res, { analyzedName: githubData.profile.name, report });
      return;
    }

    if (!env.openaiApiKey) {
      sendError(res, 500, "OpenAI API key is not configured");
      return;
    }

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
