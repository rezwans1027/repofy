"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";

interface ReportListItem {
  id: string;
  analyzed_username: string;
  overall_score: number;
  recommendation: string;
  generated_at: string;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("reports")
      .select("id, analyzed_username, overall_score, recommendation, generated_at")
      .order("generated_at", { ascending: false })
      .then(({ data }) => {
        setReports((data as ReportListItem[]) ?? []);
        setLoading(false);
      });
  }, []);

  const scoreColor = (score: number) =>
    score >= 80
      ? "text-emerald-400"
      : score >= 60
        ? "text-yellow-400"
        : "text-red-400";

  const recStyle = (rec: string) =>
    rec === "Strong Hire"
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
      : "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="font-mono text-lg font-bold">Reports</h1>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-lg bg-secondary" />
          ))}
        </div>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="font-mono text-lg font-bold">Reports</h1>
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="text-center">
            <FileText className="mx-auto size-10 text-muted-foreground/30" />
            <p className="mt-3 font-mono text-sm text-muted-foreground">
              No reports yet
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Search for a developer and generate your first analysis.
            </p>
            <Link
              href="/dashboard"
              className="mt-4 inline-flex items-center gap-1.5 font-mono text-xs text-cyan hover:underline"
            >
              Go to search
              <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="font-mono text-lg font-bold">Reports</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => (
          <Link
            key={report.id}
            href={`/report/${report.id}`}
            className="group rounded-lg border border-border bg-card p-4 transition-colors hover:border-cyan/30"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-sm font-bold group-hover:text-cyan transition-colors">
                  @{report.analyzed_username}
                </p>
                <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                  {new Date(report.generated_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
              <span className={`font-mono text-lg font-bold ${scoreColor(report.overall_score)}`}>
                {report.overall_score}
              </span>
            </div>
            <div className="mt-3">
              <Badge className={`border text-[10px] ${recStyle(report.recommendation)}`}>
                {report.recommendation}
              </Badge>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
