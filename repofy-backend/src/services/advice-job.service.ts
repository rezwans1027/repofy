import { getSupabaseAdmin } from "../config/supabase";
import { throwIfDbError } from "../lib/errors";

export interface AdviceJob {
  id: string;
  user_id: string;
  analyzed_username: string;
  status: "processing" | "completed" | "failed";
  advice_id: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

const JOB_SELECT = "id, user_id, analyzed_username, status, advice_id, error, created_at, updated_at";

export async function createJob(userId: string, username: string): Promise<AdviceJob> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("advice_jobs")
    .insert({ user_id: userId, analyzed_username: username.toLowerCase() })
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
 * Mark any "processing" jobs older than the stale timeout as failed.
 * Called before checking for active jobs so users aren't permanently blocked
 * by jobs that died mid-flight (e.g. server crash or redeploy).
 */
export async function expireStaleJobs(userId: string): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_JOB_TIMEOUT_MS).toISOString();
  const supabase = getSupabaseAdmin();
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
}
