"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { GitCompareArrows, ArrowRight } from "lucide-react";
import type { ReportData } from "@/components/report/analysis-report";
import {
  CandidatePicker,
} from "@/components/compare/candidate-picker";
import { ComparisonVerdict } from "@/components/compare/comparison-verdict";
import { ComparisonRadarChart } from "@/components/compare/comparison-radar-chart";
import { ComparisonStats } from "@/components/compare/comparison-stats";
import { ComparisonActivity } from "@/components/compare/comparison-activity";
import { ComparisonLanguages } from "@/components/compare/comparison-languages";
import {
  ComparisonSideBySide,
  StrengthsList,
  WeaknessesList,
  RedFlagsList,
  InterviewQuestionsList,
  TopReposList,
} from "@/components/compare/comparison-side-by-side";
import { ComparisonExportBar } from "@/components/compare/comparison-export-bar";
import { useReports, useReport } from "@/hooks/use-reports";

export default function ComparePage() {
  const { data: reports, isLoading: loading, error } = useReports();
  const [reportIdA, setReportIdA] = useState("");
  const [reportIdB, setReportIdB] = useState("");
  const { data: reportDataA } = useReport(reportIdA);
  const { data: reportDataB } = useReport(reportIdB);
  const comparisonRef = useRef<HTMLDivElement>(null);

  const bothLoaded = reportDataA && reportDataB;
  const usernameA = reportDataA?.analyzed_username ?? "";
  const usernameB = reportDataB?.analyzed_username ?? "";
  const dataA = reportDataA?.report_data as ReportData | undefined;
  const dataB = reportDataB?.report_data as ReportData | undefined;

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-48 animate-pulse rounded bg-secondary" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-24 animate-pulse rounded-lg border border-border bg-card" />
          <div className="h-24 animate-pulse rounded-lg border border-border bg-card" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="font-mono text-lg font-bold">Compare</h1>
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-6 text-center space-y-2">
          <p className="font-mono text-sm text-red-400">{error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="font-mono text-xs text-muted-foreground hover:text-cyan transition-colors underline underline-offset-2"
          >
            retry
          </button>
        </div>
      </div>
    );
  }

  if (!reports) return null;

  // Empty state: need at least 2 reports
  if (reports.length < 2) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="space-y-4"
      >
        <h1 className="font-mono text-lg font-bold">Compare</h1>
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="text-center">
            <GitCompareArrows className="mx-auto size-10 text-muted-foreground/30" />
            <p className="mt-3 font-mono text-sm text-muted-foreground">
              Need at least 2 reports to compare
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Generate reports for different candidates, then compare them side-by-side.
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
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-4 pb-20"
    >
      <h1 className="font-mono text-lg font-bold">Compare Candidates</h1>

      {/* Candidate pickers */}
      <div className="grid gap-4 lg:grid-cols-2">
        <CandidatePicker
          reports={reports}
          value={reportIdA}
          onValueChange={setReportIdA}
          disabledId={reportIdB}
          slot="A"
        />
        <CandidatePicker
          reports={reports}
          value={reportIdB}
          onValueChange={setReportIdB}
          disabledId={reportIdA}
          slot="B"
        />
      </div>

      {/* Comparison content */}
      {bothLoaded && dataA && dataB && (
        <>
          <div ref={comparisonRef} className="space-y-4">
            {/* Verdict */}
            <ComparisonVerdict
              usernameA={usernameA}
              usernameB={usernameB}
              reportA={dataA}
              reportB={dataB}
            />

            {/* Radar chart */}
            <ComparisonRadarChart
              dataA={dataA.radarAxes}
              dataB={dataB.radarAxes}
              usernameA={usernameA}
              usernameB={usernameB}
              breakdownA={dataA.radarBreakdown}
              breakdownB={dataB.radarBreakdown}
            />

            {/* Stats */}
            <ComparisonStats
              reportA={dataA}
              reportB={dataB}
              usernameA={usernameA}
              usernameB={usernameB}
            />

            {/* Activity */}
            <ComparisonActivity
              reportA={dataA}
              reportB={dataB}
              usernameA={usernameA}
              usernameB={usernameB}
            />

            {/* Languages */}
            <ComparisonLanguages
              reportA={dataA}
              reportB={dataB}
              usernameA={usernameA}
              usernameB={usernameB}
            />

            {/* Top Repos side-by-side */}
            <ComparisonSideBySide
              title="Top Repositories"
              subtitle="Deep dive into signature projects"
              labelA={usernameA}
              labelB={usernameB}
              renderA={() => <TopReposList repos={dataA.topRepos} />}
              renderB={() => <TopReposList repos={dataB.topRepos} />}
            />

            {/* Strengths side-by-side */}
            <ComparisonSideBySide
              title="Strengths"
              labelA={usernameA}
              labelB={usernameB}
              renderA={() => <StrengthsList strengths={dataA.strengths} />}
              renderB={() => <StrengthsList strengths={dataB.strengths} />}
            />

            {/* Weaknesses side-by-side */}
            <ComparisonSideBySide
              title="Areas for Improvement"
              labelA={usernameA}
              labelB={usernameB}
              renderA={() => <WeaknessesList weaknesses={dataA.weaknesses} />}
              renderB={() => <WeaknessesList weaknesses={dataB.weaknesses} />}
            />

            {/* Red Flags side-by-side */}
            <ComparisonSideBySide
              title="Red Flags"
              labelA={usernameA}
              labelB={usernameB}
              variant="red-flags"
              renderA={() => <RedFlagsList redFlags={dataA.redFlags} />}
              renderB={() => <RedFlagsList redFlags={dataB.redFlags} />}
            />

            {/* Interview Questions side-by-side */}
            <ComparisonSideBySide
              title="Suggested Interview Questions"
              subtitle="Tailored to each candidate's profile"
              labelA={usernameA}
              labelB={usernameB}
              renderA={() => <InterviewQuestionsList questions={dataA.interviewQuestions} />}
              renderB={() => <InterviewQuestionsList questions={dataB.interviewQuestions} />}
            />
          </div>

          {/* Export bar */}
          <ComparisonExportBar
            usernameA={usernameA}
            usernameB={usernameB}
            comparisonRef={comparisonRef}
          />
        </>
      )}
    </motion.div>
  );
}
