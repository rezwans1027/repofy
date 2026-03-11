import crypto from "crypto";
import { RequestHandler } from "express";
import { env } from "../config/env";
import { fetchGitHubUserData } from "../services/github.service";
import { generateAdvice } from "../services/advice.service";
import { buildAdviceData } from "../services/advice-builder.service";
import { getCreditBalance } from "../services/credit.service";
import { deductAndPersist } from "../services/advice-persistence.service";
import { USERNAME_RE } from "../lib/validators";
import { sendError, sendSuccess } from "../lib/response";
import { handleControllerError } from "../lib/controller-utils";
import type { AuthenticatedRequest } from "../types";

/**
 * Track in-flight advice requests per user to prevent concurrent expensive calls.
 *
 * This is an in-memory, per-process guard — it will NOT prevent duplicate
 * requests across multiple server instances. However, the downstream
 * `advice` table upsert on `(user_id, analyzed_username)` ensures at most
 * one advice row per user/target pair, so the worst-case race is a single
 * extra credit deduction rather than duplicate data.
 *
 * Migration options for multi-instance deployments:
 *  - Postgres advisory lock: `SELECT pg_try_advisory_lock(hashtext(userId))` — zero deps
 *  - Redis SETNX: `SET advice:lock:{userId} 1 NX EX 120` — if Redis is already in the stack
 *  - Idempotency key on credit deduction: pass `requestId` to a UNIQUE constraint so
 *    the second deduction attempt is silently rejected at the DB level
 */
const activeAdviceRequests = new Map<string, true>();

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
  activeAdviceRequests.set(userId, true);

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

    if (!env.openaiApiKey) {
      sendError(res, 500, "OpenAI API key is not configured");
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
    const aiAdvice = await generateAdvice(githubData, req.signal);
    const advice = buildAdviceData(aiAdvice, githubData);

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
