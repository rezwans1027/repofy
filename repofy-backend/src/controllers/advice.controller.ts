import crypto from "crypto";
import { RequestHandler } from "express";
import { env } from "../config/env";
import { getSupabaseAdmin } from "../config/supabase";
import {
  fetchGitHubUserData,
  GitHubError,
} from "../services/github.service";
import { generateAdvice } from "../services/advice.service";
import { buildAdviceData } from "../services/advice-builder.service";
import { getCreditBalance, deductGrowthCredit } from "../services/credit.service";
import { USERNAME_RE } from "../lib/validators";
import { sendError, sendSuccess } from "../lib/response";
import { logger } from "../lib/logger";

/** Atomically deduct one credit and persist advice in a single step. */
async function deductAndPersist(
  userId: string,
  requestId: string,
  analyzedUsername: string,
  analyzedName: string | null,
  adviceData: Record<string, unknown>,
): Promise<string> {
  // 1. Atomic deduct — fails if balance is 0
  const deducted = await deductGrowthCredit(userId, requestId, {
    username: analyzedUsername,
    endpoint: "/advice",
  });
  if (!deducted) throw new InsufficientCreditsError();

  // 2. Persist — if this fails the credit is lost, but this is a simple DB write
  //    with near-zero failure rate vs. a 60s+ AI call
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("advice")
    .upsert(
      { user_id: userId, analyzed_username: analyzedUsername, analyzed_name: analyzedName, advice_data: adviceData },
      { onConflict: "user_id,analyzed_username" },
    )
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

class InsufficientCreditsError extends Error {
  constructor() {
    super("Insufficient growth credits");
    this.name = "InsufficientCreditsError";
  }
}

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
