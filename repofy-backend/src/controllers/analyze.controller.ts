import { RequestHandler } from "express";
import { env } from "../config/env";
import { fetchGitHubUserData } from "../services/github.service";
import { callEngine } from "../services/engine.service";
import { buildReportData } from "../services/analyze.service";
import {
  computeSnapshotHash,
  buildCacheKey,
  getCachedAnalysis,
  setCachedAnalysis,
} from "../services/cache.service";
import { saveReport } from "../services/reports.service";
import { logTokenUsage } from "../lib/usage-logger";
import { USERNAME_RE } from "../lib/validators";
import { sendError, sendSuccess } from "../lib/response";
import { logger } from "../lib/logger";
import { handleControllerError } from "../lib/controller-utils";
import type { AuthenticatedRequest, ScorerResponse, ScoringResult } from "../types";

interface AnalyzeEngineResponse {
  scorerResponse: ScorerResponse;
  scoringResult: ScoringResult;
  narrativeReport: string;
  tokenUsage?: { endpoint: string; model: string; usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } }[];
}

// RUBRIC_VERSION must match the engine's version for cache key consistency
const RUBRIC_VERSION = "v1.1";

export const analyzeUser: RequestHandler = async (req, res) => {
  const username = req.params.username as string;

  if (!USERNAME_RE.test(username)) {
    sendError(res, 400, "Invalid GitHub username format");
    return;
  }

  const { userId } = req as AuthenticatedRequest;

  try {
    if (env.mockAi) {
      const { buildMockReport, buildMockGitHubData } = await import("../services/mock-ai.service");
      const githubData = buildMockGitHubData(username);
      const report = buildMockReport(githubData);
      const reportId = await saveReport(userId, username, githubData.profile.name, report);
      sendSuccess(res, { analyzedName: githubData.profile.name, report, reportId });
      return;
    }

    // 1. Fetch GitHub data (with snapshots + aggregate metrics)
    const githubData = await fetchGitHubUserData(username, req.signal);

    // 2. Compute snapshot hash → check cache
    const snapshotHash = computeSnapshotHash(githubData);
    const cacheKey = buildCacheKey(env.openaiModel, RUBRIC_VERSION, snapshotHash);

    const cached = await getCachedAnalysis(cacheKey);
    if (cached) {
      logger.info(`Cache hit for ${username} (key: ${cacheKey.slice(0, 8)}...)`);
      const report = buildReportData(
        cached.scorerResponse,
        cached.scoringResult,
        cached.narrativeReport,
        githubData,
      );
      const reportId = await saveReport(userId, username, githubData.profile.name, report);
      sendSuccess(res, { analyzedName: githubData.profile.name, report, reportId });
      return;
    }

    // 3. Call engine for AI analysis
    const { scorerResponse, scoringResult, narrativeReport, tokenUsage } =
      await callEngine<AnalyzeEngineResponse>("/analyze", { githubData }, req.signal);

    // Log token usage to Supabase (fire-and-forget)
    tokenUsage?.forEach((u) => logTokenUsage(u.endpoint, u.model, u.usage));

    // 4. Cache results (fire-and-forget)
    setCachedAnalysis(cacheKey, snapshotHash, env.openaiModel, RUBRIC_VERSION, {
      scorerResponse,
      scoringResult,
      narrativeReport,
    });

    // 5. Build report & persist
    const report = buildReportData(scorerResponse, scoringResult, narrativeReport, githubData);
    const reportId = await saveReport(userId, username, githubData.profile.name, report);

    sendSuccess(res, {
      analyzedName: githubData.profile.name,
      report,
      reportId,
    });
  } catch (err) {
    handleControllerError(err, req, res, "Analysis", "Analysis failed. Please try again.");
  }
};
