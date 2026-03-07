import crypto from "crypto";
import { RequestHandler } from "express";
import { env } from "../config/env";
import {
  fetchGitHubUserData,
  GitHubError,
} from "../services/github.service";
import { generateAdvice } from "../services/advice.service";
import { buildAdviceData } from "../services/advice-builder.service";
import { getCreditBalance } from "../services/credit.service";
import { deductAndPersist, InsufficientCreditsError } from "../services/advice-persistence.service";
import { USERNAME_RE } from "../lib/validators";
import { sendError, sendSuccess } from "../lib/response";
import { logger } from "../lib/logger";

/** Track in-flight advice requests per user to prevent concurrent expensive calls. */
const activeAdviceRequests = new Map<string, true>();

export const adviseUser: RequestHandler = async (req, res) => {
  const username = req.params.username as string;

  if (!USERNAME_RE.test(username)) {
    sendError(res, 400, "Invalid GitHub username format");
    return;
  }

  if (activeAdviceRequests.has(req.userId!)) {
    sendError(res, 429, "An advice request is already in progress. Please wait.");
    return;
  }

  const requestId = crypto.randomUUID();
  activeAdviceRequests.set(req.userId!, true);

  try {
    if (env.mockAi) {
      const { MOCK_ADVICE_RESPONSE, buildMockGitHubData } = await import("../services/mock-ai.service");
      const githubData = buildMockGitHubData(username);
      const advice = buildAdviceData(MOCK_ADVICE_RESPONSE, githubData);
      const adviceId = await deductAndPersist(
        req.userId!,
        requestId,
        username.toLowerCase(),
        githubData.profile.name,
        advice,
      );
      sendSuccess(res, { adviceId });
      return;
    }

    if (!env.openaiApiKey) {
      sendError(res, 500, "OpenAI API key is not configured");
      return;
    }

    // Cheap pre-check: reject early if user has zero credits (avoids burning GitHub quota)
    const balance = await getCreditBalance(req.userId!);
    if (balance.growth_balance <= 0) {
      sendError(res, 402, "Insufficient growth credits");
      return;
    }

    // Do ALL expensive work before touching credits
    const githubData = await fetchGitHubUserData(username, req.signal);
    const aiAdvice = await generateAdvice(githubData, req.signal);
    const advice = buildAdviceData(aiAdvice, githubData);

    // Only deduct + persist after everything succeeded
    const adviceId = await deductAndPersist(
      req.userId!,
      requestId,
      username.toLowerCase(),
      githubData.profile.name,
      advice,
    );

    sendSuccess(res, { adviceId });
  } catch (err) {
    if (req.signal?.aborted || res.headersSent) return;
    if (err instanceof InsufficientCreditsError) {
      sendError(res, 402, err.message);
      return;
    }
    if (err instanceof GitHubError) {
      sendError(res, err.statusCode, err.message);
      return;
    }
    logger.error("Advice error:", err);
    sendError(res, 500, "Advice generation failed. Please try again.");
  } finally {
    activeAdviceRequests.delete(req.userId!);
  }
};
