import crypto from "crypto";
import { RequestHandler } from "express";
import { env } from "../config/env";
import { fetchGitHubUserData } from "../services/github.service";
import { callEngine } from "../services/engine.service";
import { buildAdviceData } from "../services/advice-builder.service";
import { getCreditBalance } from "../services/credit.service";
import { deductAndPersist } from "../services/advice-persistence.service";
import { logTokenUsage, type TokenUsage } from "../lib/usage-logger";
import { USERNAME_RE } from "../lib/validators";
import { sendError, sendSuccess } from "../lib/response";
import { handleControllerError } from "../lib/controller-utils";
import { advisoryLock } from "../lib/distributed-lock";
import type { AuthenticatedRequest, AdviceV2 } from "../types";

interface AdviceEngineResponse {
  advice: AdviceV2;
  tokenUsage?: { endpoint: string; model: string; usage: TokenUsage }[];
}

/** TTL for the distributed advice lock (seconds). */
const ADVICE_LOCK_TTL_SECS = 10 * 60; // 10 minutes (max realistic advice duration)

/** Build a consistent lock key for a user's advice request. */
function adviceLockKey(userId: string): string {
  return `advice:${userId}`;
}

export const adviseUser: RequestHandler = async (req, res) => {
  const username = req.params.username as string;

  if (!USERNAME_RE.test(username)) {
    sendError(res, 400, "Invalid GitHub username format");
    return;
  }

  const { userId } = req as AuthenticatedRequest;
  const lockKey = adviceLockKey(userId);

  const acquired = await advisoryLock.acquire(lockKey, ADVICE_LOCK_TTL_SECS);
  if (!acquired) {
    sendError(res, 429, "An advice request is already in progress. Please wait.");
    return;
  }

  const requestId = crypto.randomUUID();

  try {
    if (env.mockAi) {
      const { MOCK_ADVICE_RESPONSE, buildMockGitHubData } = await import("../services/mock-ai.service");
      const githubData = buildMockGitHubData(username);
      const advice = buildAdviceData(MOCK_ADVICE_RESPONSE, githubData);
      const adviceId = await deductAndPersist(
        userId,
        requestId,
        username.toLowerCase(),
        githubData.profile.name,
        advice,
      );
      sendSuccess(res, { adviceId });
      return;
    }

    if (!req.githubToken) {
      sendError(res, 403, "GitHub authentication required. Please sign in again.");
      return;
    }

    // Cheap pre-check: reject early if user has zero credits (avoids burning GitHub quota)
    const balance = await getCreditBalance(userId);
    if (balance.growth_balance <= 0) {
      sendError(res, 402, "Insufficient growth credits");
      return;
    }

    // Do ALL expensive work before touching credits
    const githubData = await fetchGitHubUserData(username, req.signal, req.githubToken);

    const { advice: aiAdvice, tokenUsage } =
      await callEngine<AdviceEngineResponse>("/advice", { githubData }, req.signal);

    // Log token usage to Supabase (fire-and-forget)
    tokenUsage?.forEach((u) => logTokenUsage(u.endpoint, u.model, u.usage));

    const advice = buildAdviceData(aiAdvice, githubData);

    // If the client disconnected while we were working, skip deducting credits
    if (req.signal?.aborted) {
      return;
    }

    // Only deduct + persist after everything succeeded
    const adviceId = await deductAndPersist(
      userId,
      requestId,
      username.toLowerCase(),
      githubData.profile.name,
      advice,
    );

    sendSuccess(res, { adviceId });
  } catch (err) {
    handleControllerError(err, req, res, "Advice", "Advice generation failed. Please try again.");
  } finally {
    await advisoryLock.release(lockKey);
  }
};
