"use client";

import { use } from "react";
import { useSearchParams } from "next/navigation";
import { AnalysisReport } from "@/components/report/analysis-report";
import { useAuth } from "@/components/providers/auth-provider";
import { useReport } from "@/hooks/use-reports";
import { BackLink } from "@/components/ui/back-link";
import { ErrorCard } from "@/components/ui/error-card";

export default function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const fromProfile = searchParams.get("from") === "profile";
  const { isLoading: authLoading } = useAuth();
  const { data: report, isLoading: queryLoading, error } = useReport(id);
  const loading = authLoading || queryLoading;

  const backHref = fromProfile && report
    ? `/profile/${report.analyzed_username}`
    : "/reports";
  const backLabel = fromProfile && report ? "back to profile" : "back to reports";

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-32 animate-pulse rounded bg-secondary" />
        <div className="h-32 animate-pulse rounded-lg bg-secondary" />
        <div className="h-48 animate-pulse rounded-lg bg-secondary" />
        <div className="h-48 animate-pulse rounded-lg bg-secondary" />
      </div>
    );
  }

  if (error || !report) {
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
