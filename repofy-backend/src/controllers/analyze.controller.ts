import { RequestHandler } from "express";
import { env } from "../config/env";
import { fetchGitHubUserData, GitHubError } from "../services/github.service";
import { generateScorerResponse, generateNarrativeReport } from "../services/openai.service";
import { computeScoring } from "../services/scoring.service";
import { buildReportData } from "../services/analyze.service";
import {
  computeSnapshotHash,
  buildCacheKey,
  getCachedAnalysis,
  setCachedAnalysis,
} from "../services/cache.service";
import { USERNAME_RE } from "../lib/validators";
import { sendError, sendSuccess } from "../lib/response";
import { logger } from "../lib/logger";

const RUBRIC_VERSION = "v1.1";

export const analyzeUser: RequestHandler = async (req, res) => {
  const username = req.params.username as string;

  if (!USERNAME_RE.test(username)) {
    sendError(res, 400, "Invalid GitHub username format");
    return;
  }

  try {
    if (env.mockAi) {
      const { buildMockReport, buildMockGitHubData } = await import("../services/mock-ai.service");
      const githubData = buildMockGitHubData(username);
      const report = buildMockReport(githubData);
      sendSuccess(res, { analyzedName: githubData.profile.name, report });
      return;
    }

    if (!env.openaiApiKey) {
      sendError(res, 500, "OpenAI API key is not configured");
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
      sendSuccess(res, { analyzedName: githubData.profile.name, report });
      return;
    }

    // 3. Call Scorer
    const scorerResponse = await generateScorerResponse(githubData, req.signal);

    // 4. Compute scoring (backend deterministic)
    const scoringResult = computeScoring(
      scorerResponse,
      githubData.aggregateMetrics,
      githubData.repoSnapshots,
    );

    // 5. Call Narrator
    const narrativeReport = await generateNarrativeReport(
      scorerResponse,
      scoringResult,
      req.signal,
    );

    // 6. Cache results (fire-and-forget)
    setCachedAnalysis(cacheKey, snapshotHash, env.openaiModel, RUBRIC_VERSION, {
      scorerResponse,
      scoringResult,
      narrativeReport,
    });

    // 7. Build report
    const report = buildReportData(scorerResponse, scoringResult, narrativeReport, githubData);

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
