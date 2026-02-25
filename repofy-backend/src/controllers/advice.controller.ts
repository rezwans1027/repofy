import crypto from "crypto";
import { RequestHandler } from "express";
import { env } from "../config/env";
import {
  fetchGitHubUserData,
  GitHubError,
} from "../services/github.service";
import { generateAdvice } from "../services/advice.service";
import { buildAdviceData } from "../services/advice-builder.service";
import { deductGrowthCredit, refundGrowthCredit } from "../services/credit.service";
import { USERNAME_RE } from "../lib/validators";
import { sendError, sendSuccess } from "../lib/response";
import { isRefundableError } from "../lib/errors";
import { logger } from "../lib/logger";

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
      sendSuccess(res, { analyzedName: githubData.profile.name, advice });
      return;
    }

    if (!env.openaiApiKey) {
      sendError(res, 500, "OpenAI API key is not configured");
      return;
    }

    // Fetch GitHub data BEFORE deducting — 4xx here costs no credit
    const githubData = await fetchGitHubUserData(username, req.signal);

    // Deduct credit immediately before AI call
    const deducted = await deductGrowthCredit(req.userId!, requestId, {
      username,
      endpoint: "/advice",
    });
    if (!deducted) {
      sendError(res, 402, "Insufficient growth credits");
      return;
    }

    // Everything after deduction is credit-guarded — refund on refundable failure
    let creditDeducted = !env.mockAi;
    try {
      const aiAdvice = await generateAdvice(githubData, req.signal);
      const advice = buildAdviceData(aiAdvice, githubData);

      sendSuccess(res, {
        analyzedName: githubData.profile.name,
        advice,
      });
      creditDeducted = false; // success — no refund needed
    } catch (postDeductErr) {
      if (creditDeducted && isRefundableError(postDeductErr)) {
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
