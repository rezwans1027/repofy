import { AnalysisReport } from "@/components/report/analysis-report";
import { serverFetch } from "@/lib/server-api";
import { BackLink } from "@/components/ui/back-link";
import { ErrorCard } from "@/components/ui/error-card";
import type { ReportData } from "@shared/types/report";

interface ReportRow {
  id: string;
  analyzed_username: string;
  report_data: ReportData;
}

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const fromProfile = from === "profile";

  const report = await serverFetch<ReportRow>(`/reports/${id}`);

  if (!report) {
    return (
      <div>
        <BackLink href="/reports" label="back to reports" />
        <ErrorCard
          message="Report not found"
          detail="This report may have been deleted or you don't have access to it."
          variant="neutral"
        />
      </div>
    );
  }

  const backHref = fromProfile
    ? `/profile/${report.analyzed_username}`
    : "/reports";
  const backLabel = fromProfile ? "back to profile" : "back to reports";

  return (
    <div>
      <BackLink href={backHref} label={backLabel} />
      <AnalysisReport
        username={report.analyzed_username}
        data={report.report_data}
      />
    </div>
  );
}
