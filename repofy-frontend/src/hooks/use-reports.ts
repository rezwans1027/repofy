import { z } from "zod";
import { createCrudHooks } from "./use-crud";
import type { ReportData } from "@shared/types/report";

const reportListItemSchema = z.object({
  id: z.string(),
  analyzed_username: z.string(),
  overall_score: z.number(),
  recommendation: z.string(),
  generated_at: z.string(),
  analyzed_name: z.string().nullable(),
});

const reportRowSchema = z.object({
  id: z.string(),
  analyzed_username: z.string(),
  report_data: z.record(z.string(), z.unknown()),
});

export type ReportListItem = z.infer<typeof reportListItemSchema>;

type ReportRow = z.infer<typeof reportRowSchema> & { report_data: ReportData };

const crud = createCrudHooks<ReportListItem>({
  queryKey: "reports",
  endpoint: "/reports",
  listSchema: z.array(reportListItemSchema),
  detailSchema: reportRowSchema,
});

export const useReports = crud.useList;
export const useReport = crud.useDetail;
export const useExistingReport = crud.useExists;
export const useDeleteReports = crud.useDelete;
