import { getSupabaseAdmin } from "../config/supabase";
import { throwIfDbError, DatabaseError } from "../lib/errors";
import { createCrudService } from "./crud.service";
import type { ReportData } from "../types/shared/report";

const crud = createCrudService({
  table: "reports",
  entityName: "report",
  listSelect: "id, analyzed_username, analyzed_name, overall_score, recommendation, generated_at",
  detailSelect: "id, analyzed_username, report_data",
  existsColumn: "analyzed_username",
});

export const listReports = crud.list;
export const getReportById = crud.getById;
export const reportCount = crud.count;
export const deleteReports = crud.deleteBatch;

export async function saveReport(
  userId: string,
  analyzedUsername: string,
  analyzedName: string | null,
  report: ReportData,
): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("reports")
    .upsert(
      {
        user_id: userId,
        analyzed_username: analyzedUsername.toLowerCase(),
        analyzed_name: analyzedName,
        overall_score: report.overallScore,
        recommendation: report.recommendation,
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
