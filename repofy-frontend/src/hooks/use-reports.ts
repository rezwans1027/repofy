import { createSupabaseQueries } from "@/lib/supabase-queries";
import type { ReportData } from "@/components/report/analysis-report";

export interface ReportListItem {
  id: string;
  analyzed_username: string;
  overall_score: number;
  recommendation: string;
  generated_at: string;
  analyzed_name: string | null;
}

interface ReportRow {
  id: string;
  analyzed_username: string;
  report_data: ReportData;
}

const reportQueries = createSupabaseQueries<ReportListItem, ReportRow>({
  table: "reports",
  queryKeyPrefix: "reports",
  listSelect:
    "id, analyzed_username, analyzed_name, overall_score, recommendation, generated_at",
  detailSelect: "id, analyzed_username, report_data",
});

export const useReports = reportQueries.useList;
export const useReport = reportQueries.useById;
export const useExistingReport = reportQueries.useExisting;
export const useDeleteReports = reportQueries.useDelete;
