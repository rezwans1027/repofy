import { getSupabaseAdmin } from "../config/supabase";
import { throwIfDbError, DatabaseError } from "../lib/errors";

export async function saveReport(
  userId: string,
  analyzedUsername: string,
  analyzedName: string | null,
  report: Record<string, unknown>,
): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("reports")
    .upsert(
      {
        user_id: userId,
        analyzed_username: analyzedUsername.toLowerCase(),
        analyzed_name: analyzedName,
        overall_score: typeof report.overallScore === "number" ? report.overallScore : 0,
        recommendation: typeof report.recommendation === "string" ? report.recommendation : "",
        report_data: report,
      },
      { onConflict: "user_id,analyzed_username" },
    )
    .select("id")
    .single();

  throwIfDbError(error, "save report");
  if (!data?.id) throw new DatabaseError("save report returned no id", null);
  return data.id as string;
}

export async function listReports(userId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("reports")
    .select("id, analyzed_username, analyzed_name, overall_score, recommendation, generated_at")
    .eq("user_id", userId)
    .order("generated_at", { ascending: false });
  throwIfDbError(error, "list reports");
  return data ?? [];
}

export async function getReportById(userId: string, id: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("reports")
    .select("id, analyzed_username, report_data")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  throwIfDbError(error, "get report");
  return data;
}

export async function reportExists(userId: string, username: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("reports")
    .select("id")
    .eq("user_id", userId)
    .eq("analyzed_username", username.toLowerCase())
    .limit(1);
  throwIfDbError(error, "check report exists");
  return !!data && data.length > 0;
}

export async function deleteReports(userId: string, ids: string[]) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("reports")
    .delete()
    .in("id", ids)
    .eq("user_id", userId);
  throwIfDbError(error, "delete reports");
}
