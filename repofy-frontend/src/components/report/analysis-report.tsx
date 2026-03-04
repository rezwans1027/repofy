"use client";

import { useRef, useState } from "react";
import { reportData as staticReportData } from "@/lib/demo-data";

import { TopBanner } from "./sections/top-banner";
import { Summary } from "./sections/summary";
import { RadarSection } from "./sections/radar-section";
import { StatsOverview } from "./sections/stats-overview";
import { ActivityBreakdown } from "./sections/activity-breakdown";
import { LanguageProfile } from "./sections/language-profile";
import { TopRepos } from "./sections/top-repos";
import { Strengths } from "./sections/strengths";
import { Weaknesses } from "./sections/weaknesses";
import { RedFlags } from "./sections/red-flags";
import { InterviewQuestions } from "./sections/interview-questions";
import { ExportBar } from "./sections/export-bar";
import { AnalysisReportPdfLayout } from "./pdf-layout";

export type ReportData = typeof staticReportData;

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
