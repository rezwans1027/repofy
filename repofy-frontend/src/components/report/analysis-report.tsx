"use client";

import { lazy, Suspense, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { reportData as staticReportData } from "@/lib/demo-data";
import type { ReportData } from "@shared/types/report";

import { TopBanner } from "./sections/top-banner";
import { Summary } from "./sections/summary";
import { ExportBar } from "./sections/export-bar";

const AnalysisReportPdfLayout = dynamic(
  () => import("./pdf-layout").then((m) => ({ default: m.AnalysisReportPdfLayout })),
  { ssr: false }
);

const RadarSection = lazy(() => import("./sections/radar-section").then(m => ({ default: m.RadarSection })));
const StatsOverview = lazy(() => import("./sections/stats-overview").then(m => ({ default: m.StatsOverview })));
const ActivityBreakdown = lazy(() => import("./sections/activity-breakdown").then(m => ({ default: m.ActivityBreakdown })));
const LanguageProfile = lazy(() => import("./sections/language-profile").then(m => ({ default: m.LanguageProfile })));
const TopRepos = lazy(() => import("./sections/top-repos").then(m => ({ default: m.TopRepos })));
const Strengths = lazy(() => import("./sections/strengths").then(m => ({ default: m.Strengths })));
const Weaknesses = lazy(() => import("./sections/weaknesses").then(m => ({ default: m.Weaknesses })));
const RedFlags = lazy(() => import("./sections/red-flags").then(m => ({ default: m.RedFlags })));
const InterviewQuestions = lazy(() => import("./sections/interview-questions").then(m => ({ default: m.InterviewQuestions })));

interface AnalysisReportProps {
  username: string;
  avatarUrl?: string;
  data?: ReportData;
}

export function AnalysisReport({ username, avatarUrl, data }: AnalysisReportProps) {
  const pdfRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const reportData = data ?? staticReportData;

  return (
    <div className="space-y-4 pb-20">
      <div className="space-y-4">
        <TopBanner username={username} avatarUrl={avatarUrl} data={reportData} />
        <Summary narrativeReport={reportData.narrativeReport} />
        <Suspense fallback={
          <div className="space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-48 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        }>
        <RadarSection radarAxes={reportData.radarAxes} radarBreakdown={reportData.radarBreakdown} />
        <StatsOverview stats={reportData.stats} />
        <ActivityBreakdown activityBreakdown={reportData.activityBreakdown} />
        <LanguageProfile languageProfile={reportData.languageProfile} />
        <TopRepos topRepos={reportData.topRepos} expandAll={false} />
        <div className="grid gap-4 lg:grid-cols-2 items-stretch">
          <Strengths strengths={reportData.strengths} />
          <Weaknesses weaknesses={reportData.weaknesses} />
        </div>
        <RedFlags redFlags={reportData.redFlags} />
        <InterviewQuestions questions={reportData.interviewQuestions} />
        </Suspense>
      </div>

      {/* Off-screen PDF layout — only mounted during export */}
      {exporting && (
        <div
          aria-hidden="true"
          className="fixed pointer-events-none"
          style={{ left: "-200vw", top: 0 }}
        >
          <div ref={pdfRef} data-pdf-target className="w-[900px]">
            <AnalysisReportPdfLayout username={username} data={reportData} />
          </div>
        </div>
      )}

      <ExportBar
        username={username}
        reportRef={pdfRef}
        onBeforeExport={() => setExporting(true)}
        onAfterExport={() => setExporting(false)}
      />
    </div>
  );
}
