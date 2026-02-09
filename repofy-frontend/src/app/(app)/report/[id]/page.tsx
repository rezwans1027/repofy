"use client";

import { use } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AnalysisReport } from "@/components/report/analysis-report";
import { useReport } from "@/hooks/use-reports";

export default function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const fromProfile = searchParams.get("from") === "profile";
  const { data: report, isLoading: loading, error } = useReport(id);

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
        <div className="mb-4">
          <Link
            href="/reports"
            className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-cyan transition-colors"
          >
            <ArrowLeft className="size-3" />
            back to reports
          </Link>
        </div>
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="rounded-lg border border-border bg-card p-6 text-center max-w-md">
            <p className="font-mono text-sm text-muted-foreground">
              Report not found
            </p>
            <p className="mt-2 text-xs text-muted-foreground/70">
              This report may have been deleted or you don&apos;t have access to it.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-cyan transition-colors"
        >
          <ArrowLeft className="size-3" />
          {backLabel}
        </Link>
      </div>
      <AnalysisReport
        username={report.analyzed_username}
        data={report.report_data}
      />
    </div>
  );
}
