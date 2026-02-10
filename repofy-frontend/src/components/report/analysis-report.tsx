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

export type ReportData = typeof staticReportData;

interface AnalysisReportProps {
  username: string;
  avatarUrl?: string;
  data?: ReportData;
}

export function AnalysisReport({ username, avatarUrl, data }: AnalysisReportProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [pdfMode, setPdfMode] = useState(false);
  const reportData = data ?? staticReportData;

  return (
    <div className="space-y-4 pb-20">
      <div ref={reportRef} data-pdf-target className="space-y-4">
        <TopBanner username={username} avatarUrl={avatarUrl} data={reportData} />
        <Summary summary={reportData.summary} />
        <RadarSection radarAxes={reportData.radarAxes} radarBreakdown={reportData.radarBreakdown} />
        <StatsOverview stats={reportData.stats} />
        <ActivityBreakdown activityBreakdown={reportData.activityBreakdown} />
        <LanguageProfile languageProfile={reportData.languageProfile} />
        <TopRepos topRepos={reportData.topRepos} expandAll={pdfMode} />
        <div className="grid gap-4 lg:grid-cols-2 items-stretch">
          <Strengths strengths={reportData.strengths} />
          <Weaknesses weaknesses={reportData.weaknesses} />
        </div>
        <RedFlags redFlags={reportData.redFlags} />
        <InterviewQuestions questions={reportData.interviewQuestions} />
      </div>
      <ExportBar
        username={username}
        reportRef={reportRef}
        onBeforeExport={() => setPdfMode(true)}
        onAfterExport={() => setPdfMode(false)}
      />
    </div>
  );
}
