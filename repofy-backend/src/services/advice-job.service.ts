import { getSupabaseAdmin } from "../config/supabase";
import { throwIfDbError } from "../lib/errors";
import { refundGrowthCredit } from "./credit.service";
import { logger } from "../lib/logger";

export interface AdviceJob {
  id: string;
  user_id: string;
  analyzed_username: string;
  status: "processing" | "completed" | "failed";
  advice_id: string | null;
  request_id: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

const JOB_SELECT = "id, user_id, analyzed_username, status, advice_id, request_id, error, created_at, updated_at";

export async function createJob(userId: string, username: string, requestId?: string): Promise<AdviceJob> {
  const supabase = getSupabaseAdmin();
  const insert: Record<string, unknown> = { user_id: userId, analyzed_username: username.toLowerCase() };
  if (requestId) insert.request_id = requestId;
  const { data, error } = await supabase
    .from("advice_jobs")
    .insert(insert)
    .select(JOB_SELECT)
    .single();
  throwIfDbError(error, "create advice job");
  return data as AdviceJob;
}

export async function getActiveJob(userId: string): Promise<AdviceJob | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("advice_jobs")
    .select(JOB_SELECT)
    .eq("user_id", userId)
    .eq("status", "processing")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  throwIfDbError(error, "get active advice job");
  return data as AdviceJob | null;
}

export async function getJobById(jobId: string, userId: string): Promise<AdviceJob | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("advice_jobs")
    .select(JOB_SELECT)
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();
  throwIfDbError(error, "get advice job");
  return data as AdviceJob | null;
}

export async function completeJob(jobId: string, adviceId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("advice_jobs")
    .update({ status: "completed", advice_id: adviceId, updated_at: new Date().toISOString() })
    .eq("id", jobId);
  throwIfDbError(error, "complete advice job");
}

export async function failJob(jobId: string, errorMessage: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("advice_jobs")
    .update({ status: "failed", error: errorMessage, updated_at: new Date().toISOString() })
    .eq("id", jobId);
  throwIfDbError(error, "fail advice job");
}

/** Max time a job can stay in "processing" before it's considered stuck. */
const STALE_JOB_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Mark any "processing" jobs older than the stale timeout as failed,
 * and refund credits for jobs that have a stored request_id.
 * Called before checking for active jobs so users aren't permanently blocked
 * by jobs that died mid-flight (e.g. server crash or redeploy).
 */
export async function expireStaleJobs(userId: string): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_JOB_TIMEOUT_MS).toISOString();
  const supabase = getSupabaseAdmin();

  // Fetch stale jobs before marking them failed so we can refund credits
  const { data: staleJobs, error: fetchError } = await supabase
    .from("advice_jobs")
    .select("id, request_id, analyzed_username")
    .eq("user_id", userId)
    .eq("status", "processing")
    .lt("created_at", cutoff);
  throwIfDbError(fetchError, "fetch stale advice jobs");

  if (!staleJobs || staleJobs.length === 0) return;

  // Mark stale jobs as failed
  const { error } = await supabase
    .from("advice_jobs")
    .update({
      status: "failed",
      error: "Job timed out (server may have restarted)",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("status", "processing")
    .lt("created_at", cutoff);
  throwIfDbError(error, "expire stale advice jobs");

  // Refund credits for stale jobs that have a request_id
  for (const job of staleJobs) {
    if (job.request_id) {
      await refundGrowthCredit(userId, job.request_id, {
        reason: "job_expired_stale",
        username: job.analyzed_username,
      }).catch((e) =>
        logger.error("Failed to refund credit for stale job:", { jobId: job.id, error: e }),
      );
    }
  }
}
