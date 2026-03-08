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
