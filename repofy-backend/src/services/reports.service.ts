import { getSupabaseAdmin } from "../config/supabase";

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
        overall_score: (report as { overallScore: number }).overallScore,
        recommendation: (report as { recommendation: string }).recommendation,
        report_data: report,
      },
      { onConflict: "user_id,analyzed_username" },
    )
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}
