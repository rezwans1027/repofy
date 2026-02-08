"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { GitCompareArrows, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ReportData } from "@/components/report/analysis-report";
import {
  CandidatePicker,
  type ReportListItem,
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

interface FullReport {
  id: string;
  analyzed_username: string;
  report_data: ReportData;
}

export default function ComparePage() {
  const [reports, setReports] = useState<ReportListItem[] | null>(null);
  const [reportIdA, setReportIdA] = useState("");
  const [reportIdB, setReportIdB] = useState("");
  const [reportDataA, setReportDataA] = useState<FullReport | null>(null);
  const [reportDataB, setReportDataB] = useState<FullReport | null>(null);
  const comparisonRef = useRef<HTMLDivElement>(null);

  // Fetch report list on mount
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("reports")
      .select("id, analyzed_username, analyzed_name, overall_score, recommendation, generated_at")
      .order("generated_at", { ascending: false })
      .then(({ data }) => {
        setReports((data as ReportListItem[]) ?? []);
      });
  }, []);

  // Fetch full report A when selected
  useEffect(() => {
    if (!reportIdA) {
      setReportDataA(null);
      return;
    }
    const supabase = createClient();
    supabase
      .from("reports")
      .select("id, analyzed_username, report_data")
      .eq("id", reportIdA)
      .single()
      .then(({ data }) => {
        setReportDataA((data as FullReport) ?? null);
      });
  }, [reportIdA]);

  // Fetch full report B when selected
  useEffect(() => {
    if (!reportIdB) {
      setReportDataB(null);
      return;
    }
    const supabase = createClient();
    supabase
      .from("reports")
      .select("id, analyzed_username, report_data")
      .eq("id", reportIdB)
      .single()
      .then(({ data }) => {
        setReportDataB((data as FullReport) ?? null);
      });
  }, [reportIdB]);

  const bothLoaded = reportDataA && reportDataB;
  const usernameA = reportDataA?.analyzed_username ?? "";
  const usernameB = reportDataB?.analyzed_username ?? "";
  const dataA = reportDataA?.report_data;
  const dataB = reportDataB?.report_data;

  // Not yet loaded
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
