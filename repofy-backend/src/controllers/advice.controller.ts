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
import type { AuthenticatedRequest, AdviceV2 } from "../types";

interface AdviceEngineResponse {
  advice: AdviceV2;
  tokenUsage?: { endpoint: string; model: string; usage: TokenUsage }[];
}

/**
 * Track in-flight advice requests per user to prevent concurrent expensive calls.
 *
 * NOTE: This is per-process only. In a horizontally-scaled deployment (multiple
 * replicas), each instance tracks state independently. Migrate to a shared store
 * (e.g. Redis SETNX with TTL) when scaling beyond a single process.
 *
 * Safety: entries are removed in the `finally` block of adviseUser. As a belt-
 * and-suspenders measure, a periodic sweep removes any entry older than
 * ADVICE_LOCK_TTL_MS in case a request somehow exits without cleanup.
 */
const ADVICE_LOCK_TTL_MS = 10 * 60 * 1000; // 10 minutes (max realistic advice duration)
const activeAdviceRequests = new Map<string, number>(); // userId -> timestamp

// Safety sweep: remove stale locks that survived past ADVICE_LOCK_TTL_MS.
// Unref'd so it won't prevent graceful shutdown.
const adviceLockSweepInterval = setInterval(() => {
  const now = Date.now();
  for (const [userId, startedAt] of activeAdviceRequests) {
    if (now - startedAt > ADVICE_LOCK_TTL_MS) activeAdviceRequests.delete(userId);
  }
}, 60_000); // check every minute
adviceLockSweepInterval.unref();

export const adviseUser: RequestHandler = async (req, res) => {
  const username = req.params.username as string;

  if (!USERNAME_RE.test(username)) {
    sendError(res, 400, "Invalid GitHub username format");
    return;
  }

  const { userId } = req as AuthenticatedRequest;

  if (activeAdviceRequests.has(userId)) {
    sendError(res, 429, "An advice request is already in progress. Please wait.");
    return;
  }

  const requestId = crypto.randomUUID();
  activeAdviceRequests.set(userId, Date.now());

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

    // Cheap pre-check: reject early if user has zero credits (avoids burning GitHub quota)
    const balance = await getCreditBalance(userId);
    if (balance.growth_balance <= 0) {
      sendError(res, 402, "Insufficient growth credits");
      return;
    }

    // Do ALL expensive work before touching credits
    const githubData = await fetchGitHubUserData(username, req.signal);

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
    activeAdviceRequests.delete(userId);
  }
};
