import crypto from "crypto";
import { RequestHandler } from "express";
import { env } from "../config/env";
import { fetchGitHubUserData } from "../services/github.service";
import { callEngine } from "../services/engine.service";
import { buildAdviceData } from "../services/advice-builder.service";
import { getCreditBalance, deductGrowthCredit, refundGrowthCredit } from "../services/credit.service";
import { InsufficientCreditsError } from "../services/advice-persistence.service";
import { logTokenUsage, type TokenUsage } from "../lib/usage-logger";
import { USERNAME_RE } from "../lib/validators";
import { sendError, sendSuccess } from "../lib/response";
import { handleControllerError } from "../lib/controller-utils";
import { advisoryLock } from "../lib/distributed-lock";
import { logger } from "../lib/logger";
import { createJob, getActiveJob, completeJob, failJob, expireStaleJobs } from "../services/advice-job.service";
import { getSupabaseAdmin } from "../config/supabase";
import { throwIfDbError, DatabaseError } from "../lib/errors";
import type { AuthenticatedRequest, AdviceV2 } from "../types";
import type { AdviceData } from "../types/shared/advice";

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

/** Persist advice row and return its id. */
async function persistAdvice(
  userId: string,
  analyzedUsername: string,
  analyzedName: string | null,
  adviceData: AdviceData,
  avatarUrl: string | null,
): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("advice")
    .insert({
      user_id: userId,
      analyzed_username: analyzedUsername,
      analyzed_name: analyzedName,
      advice_data: adviceData,
      avatar_url: avatarUrl,
    })
    .select("id")
    .single();
  throwIfDbError(error, "persist advice");
  if (!data?.id) throw new DatabaseError("persist advice returned no id", null);
  return data.id as string;
}

/** Background processing — GitHub fetch → engine → persist → complete job. */
async function processAdviceInBackground(
  userId: string,
  requestId: string,
  username: string,
  githubToken: string,
  jobId: string,
  lockKey: string,
): Promise<void> {
  try {
    const githubData = await fetchGitHubUserData(username, undefined, githubToken);

    const { advice: aiAdvice, tokenUsage } =
      await callEngine<AdviceEngineResponse>("/advice", { githubData });

    tokenUsage?.forEach((u) => logTokenUsage(u.endpoint, u.model, u.usage));

    const advice = buildAdviceData(aiAdvice, githubData);
    const adviceId = await persistAdvice(userId, username.toLowerCase(), githubData.profile.name, advice, githubData.profile.avatarUrl ?? null);

    await completeJob(jobId, adviceId);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Background advice generation failed";
    logger.error("Background advice generation failed:", err);

    await failJob(jobId, errorMessage).catch((e) =>
      logger.error("Failed to mark job as failed:", e),
    );

    await refundGrowthCredit(userId, requestId, {
      reason: "background_generation_failed",
      username: username.toLowerCase(),
    }).catch((e) =>
      logger.error("Failed to refund credit after background failure:", e),
    );
  } finally {
    await advisoryLock.release(lockKey);
  }
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
    // Check if there's an active job to return (idempotent)
    const existingJob = await getActiveJob(userId);
    if (existingJob) {
      res.status(202).json({ success: true, data: { jobId: existingJob.id, createdAt: existingJob.created_at } });
      return;
    }
    sendError(res, 429, "An advice request is already in progress. Please wait.");
    return;
  }

  const requestId = crypto.randomUUID();

  try {
    // Expire any stuck jobs before checking for active ones
    await expireStaleJobs(userId);

    // Check for existing active job (idempotent)
    const existingJob = await getActiveJob(userId);
    if (existingJob) {
      await advisoryLock.release(lockKey);
      res.status(202).json({ success: true, data: { jobId: existingJob.id, createdAt: existingJob.created_at } });
      return;
    }

    if (env.mockAi) {
      // Mock path: deduct credit, create job, complete immediately in background
      const balance = await getCreditBalance(userId);
      if (balance.growth_balance <= 0) {
        await advisoryLock.release(lockKey);
        sendError(res, 402, "Insufficient growth credits");
        return;
      }

      const deducted = await deductGrowthCredit(userId, requestId, {
        username: username.toLowerCase(),
        endpoint: "/advice",
      });
      if (!deducted) {
        await advisoryLock.release(lockKey);
        throw new InsufficientCreditsError();
      }

      let job;
      try {
        job = await createJob(userId, username);
      } catch (err) {
        await refundGrowthCredit(userId, requestId, {
          reason: "job_creation_failed",
          username: username.toLowerCase(),
        }).catch((e) => logger.error("Failed to refund credit after job creation failure:", e));
        throw err;
      }

      // Return 202 immediately
      res.status(202).json({ success: true, data: { jobId: job.id, createdAt: job.created_at } });

      // Complete mock job in background
      const { MOCK_ADVICE_RESPONSE, buildMockGitHubData } = await import("../services/mock-ai.service");
      const githubData = buildMockGitHubData(username);
      const advice = buildAdviceData(MOCK_ADVICE_RESPONSE, githubData);

      try {
        const adviceId = await persistAdvice(userId, username.toLowerCase(), githubData.profile.name, advice, githubData.profile.avatarUrl ?? null);
        await completeJob(job.id, adviceId);
      } catch (err) {
        logger.error("Mock advice background completion failed:", err);
        await failJob(job.id, "Mock advice persistence failed").catch(() => {});
        await refundGrowthCredit(userId, requestId, {
          reason: "mock_persist_failed",
          username: username.toLowerCase(),
        }).catch(() => {});
      } finally {
        await advisoryLock.release(lockKey);
      }
      return;
    }

    if (!req.githubToken) {
      await advisoryLock.release(lockKey);
      sendError(res, 403, "GitHub authentication required. Please sign in again.");
      return;
    }

    // Pre-check credits
    const balance = await getCreditBalance(userId);
    if (balance.growth_balance <= 0) {
      await advisoryLock.release(lockKey);
      sendError(res, 402, "Insufficient growth credits");
      return;
    }

    // Deduct credit upfront
    const deducted = await deductGrowthCredit(userId, requestId, {
      username: username.toLowerCase(),
      endpoint: "/advice",
    });
    if (!deducted) {
      await advisoryLock.release(lockKey);
      throw new InsufficientCreditsError();
    }

    // Create job — refund credit if this fails before background processing starts
    let job;
    try {
      job = await createJob(userId, username);
    } catch (err) {
      await refundGrowthCredit(userId, requestId, {
        reason: "job_creation_failed",
        username: username.toLowerCase(),
      }).catch((e) => logger.error("Failed to refund credit after job creation failure:", e));
      throw err;
    }

    // Return 202 immediately
    res.status(202).json({ success: true, data: { jobId: job.id, createdAt: job.created_at } });

    // Capture token before response completes
    const githubToken = req.githubToken;

    // Fire-and-forget background processing (lock released in finally block)
    processAdviceInBackground(userId, requestId, username, githubToken, job.id, lockKey);
  } catch (err) {
    await advisoryLock.release(lockKey);
    handleControllerError(err, req, res, "Advice", "Advice generation failed. Please try again.");
  }
};
