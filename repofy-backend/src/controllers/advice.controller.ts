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
import { getCreditBalance, deductGrowthCredit, refundGrowthCredit } from "../services/credit.service";
import { USERNAME_RE } from "../lib/validators";
import { sendError, sendSuccess } from "../lib/response";
import { isRefundableError } from "../lib/errors";
import { logger } from "../lib/logger";

/** Persist advice via Supabase admin and return the row id. */
async function persistAdvice(
  userId: string,
  analyzedUsername: string,
  analyzedName: string | null,
  adviceData: Record<string, unknown>,
): Promise<string> {
  const supabase = getSupabaseAdmin();
  const row = {
    user_id: userId,
    analyzed_username: analyzedUsername,
    analyzed_name: analyzedName,
    advice_data: adviceData,
  };

  const { data, error } = await supabase
    .from("advice")
    .upsert(row, { onConflict: "user_id,analyzed_username" })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

export const adviseUser: RequestHandler = async (req, res) => {
  const username = req.params.username as string;

  if (!USERNAME_RE.test(username)) {
    sendError(res, 400, "Invalid GitHub username format");
    return;
  }

  const requestId = crypto.randomUUID();

  try {
    if (env.mockAi) {
      const { MOCK_ADVICE_RESPONSE, buildMockGitHubData } = await import("../services/mock-ai.service");
      const githubData = buildMockGitHubData(username);
      const advice = buildAdviceData(MOCK_ADVICE_RESPONSE, githubData);
      const adviceId = await persistAdvice(
        req.userId!,
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

    // Cheap pre-check: reject early if user has zero credits (avoids GitHub quota)
    const balance = await getCreditBalance(req.userId!);
    if (balance.growth_balance <= 0) {
      sendError(res, 402, "Insufficient growth credits");
      return;
    }

    // Fetch GitHub data BEFORE deducting — 4xx here costs no credit
    const githubData = await fetchGitHubUserData(username, req.signal);

    // Atomic deduct (still needed — pre-check is non-locking)
    const deducted = await deductGrowthCredit(req.userId!, requestId, {
      username,
      endpoint: "/advice",
    });
    if (!deducted) {
      sendError(res, 402, "Insufficient growth credits");
      return;
    }

    // Everything after deduction is credit-guarded — refund on refundable failure
    try {
      const aiAdvice = await generateAdvice(githubData, req.signal);
      const advice = buildAdviceData(aiAdvice, githubData);

      // Persist server-side so deduction + artifact are atomic
      const adviceId = await persistAdvice(
        req.userId!,
        username.toLowerCase(),
        githubData.profile.name,
        advice,
      );

      sendSuccess(res, { adviceId });
    } catch (postDeductErr) {
      if (isRefundableError(postDeductErr)) {
        const refunded = await refundGrowthCredit(req.userId!, requestId, {
          reason: "post_deduction_failure",
        });
        if (!refunded) {
          logger.error("CRITICAL: refund failed", {
            userId: req.userId,
            requestId,
            error: postDeductErr instanceof Error ? postDeductErr.message : String(postDeductErr),
          });
        }
      }
      throw postDeductErr;
    }
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
