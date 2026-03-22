import { getSupabaseAdmin } from "../config/supabase";
import { throwIfDbError, DatabaseError } from "../lib/errors";

export interface UserDataExport {
  account: {
    email: string | undefined;
    metadata: Record<string, unknown>;
    created_at: string | undefined;
  };
  github: {
    username: string;
    avatar_url: string;
    updated_at: string;
  } | null;
  advice: {
    id: string;
    analyzed_username: string;
    advice_data: unknown;
    generated_at: string;
  }[];
  advice_jobs: {
    id: string;
    analyzed_username: string;
    status: string;
    error: string | null;
    created_at: string;
  }[];
  reports: {
    id: string;
    analyzed_username: string;
    overall_score: number;
    recommendation: string;
    report_data: unknown;
    generated_at: string;
  }[];
  credits: {
    growth_balance: number;
    eval_balance: number;
  };
  exported_at: string;
}

export async function exportUserData(userId: string): Promise<UserDataExport> {
  const supabase = getSupabaseAdmin();

  // Fetch auth user
  const { data: authData, error: authError } = await supabase.auth.admin.getUserById(userId);
  if (authError || !authData.user) {
    throw new DatabaseError("Failed to fetch user account", authError);
  }

  const user = authData.user;

  // Fetch all user data in parallel
  const [githubResult, adviceResult, jobsResult, reportsResult, walletResult] = await Promise.all([
    supabase
      .from("github_tokens")
      .select("github_username, github_avatar_url, updated_at")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("advice")
      .select("id, analyzed_username, advice_data, generated_at")
      .eq("user_id", userId),
    supabase
      .from("advice_jobs")
      .select("id, analyzed_username, status, error, created_at")
      .eq("user_id", userId),
    supabase
      .from("reports")
      .select("id, analyzed_username, overall_score, recommendation, report_data, generated_at")
      .eq("user_id", userId),
    supabase
      .from("credit_wallets")
      .select("growth_balance, eval_balance")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  throwIfDbError(githubResult.error, "fetch github data");
  throwIfDbError(adviceResult.error, "fetch advice data");
  throwIfDbError(jobsResult.error, "fetch advice jobs");
  throwIfDbError(reportsResult.error, "fetch reports");
  throwIfDbError(walletResult.error, "fetch credit wallet");

  return {
    account: {
      email: user.email,
      metadata: user.user_metadata ?? {},
      created_at: user.created_at,
    },
    github: githubResult.data
      ? {
          username: githubResult.data.github_username,
          avatar_url: githubResult.data.github_avatar_url,
          updated_at: githubResult.data.updated_at,
        }
      : null,
    advice: adviceResult.data ?? [],
    advice_jobs: jobsResult.data ?? [],
    reports: reportsResult.data ?? [],
    credits: walletResult.data ?? { growth_balance: 0, eval_balance: 0 },
    exported_at: new Date().toISOString(),
  };
}

export async function deleteUserAccount(userId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.auth.admin.deleteUser(userId);

  if (error) {
    throw new DatabaseError("Failed to delete user account", error);
  }
}
