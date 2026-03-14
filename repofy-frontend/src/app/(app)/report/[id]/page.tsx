import { redirect } from "next/navigation";
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

const errorMessages = {
  "not-found": { message: "Report not found", detail: "This report may have been deleted.", variant: "neutral" as const },
  "forbidden": { message: "Access denied", detail: "You don't have permission to view this report.", variant: "error" as const },
  "server-error": { message: "Something went wrong", detail: "Please try again later.", variant: "error" as const },
};

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

  const { data: report, error } = await serverFetch<ReportRow>(`/reports/${id}`, { revalidate: 3600 });

  if (error === "unauthenticated") redirect("/login");

  if (error) {
    const { message, detail, variant } = errorMessages[error];
    return (
      <div>
        <BackLink href="/reports" label="back to reports" />
        <ErrorCard message={message} detail={detail} variant={variant} />
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
