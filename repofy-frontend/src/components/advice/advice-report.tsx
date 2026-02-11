"use client";

import { useRef, useState } from "react";

import { AdviceTopBanner } from "./sections/advice-top-banner";
import { AdviceSummary } from "./sections/advice-summary";
import { ProjectIdeas } from "./sections/project-ideas";
import { RepoImprovements } from "./sections/repo-improvements";
import { SkillsToLearn } from "./sections/skills-to-learn";
import { ContributionAdvice } from "./sections/contribution-advice";
import { ProfileOptimizations } from "./sections/profile-optimizations";
import { ActionPlan } from "./sections/action-plan";
import { AdviceExportBar } from "./sections/advice-export-bar";

export interface AdviceData {
  summary: string;
  projectIdeas: {
    title: string;
    description: string;
    techStack: string[];
    difficulty: "Beginner" | "Intermediate" | "Advanced";
    why: string;
  }[];
  repoImprovements: {
    repoName: string;
    repoUrl?: string | null;
    language?: string | null;
    languageColor?: string;
    stars?: number;
    improvements: {
      area: "Testing" | "Documentation" | "CI/CD" | "Code Quality" | "Architecture";
      suggestion: string;
      priority: "High" | "Medium" | "Low";
    }[];
  }[];
  skillsToLearn: {
    skill: string;
    reason: string;
    demandLevel: "High" | "Medium" | "Growing";
    relatedTo: string;
  }[];
  contributionAdvice: { title: string; detail: string }[];
  profileOptimizations: { area: string; current: string; suggestion: string }[];
  actionPlan: {
    timeframe: "30 days" | "60 days" | "90 days";
    actions: string[];
  }[];
}

interface AdviceReportProps {
  username: string;
  avatarUrl?: string;
  data: AdviceData;
}

export function AdviceReport({ username, avatarUrl, data }: AdviceReportProps) {
  const adviceRef = useRef<HTMLDivElement>(null);
  const [pdfMode, setPdfMode] = useState(false);

  return (
    <div className="space-y-4 pb-20">
      <div ref={adviceRef} data-pdf-target className="space-y-4">
        <AdviceTopBanner username={username} avatarUrl={avatarUrl} />
        <AdviceSummary summary={data.summary} />
        <ProjectIdeas projectIdeas={data.projectIdeas} />
        <RepoImprovements repoImprovements={data.repoImprovements} expandAll={pdfMode} />
        <SkillsToLearn skills={data.skillsToLearn} />
        <div className="grid gap-4 lg:grid-cols-2 items-stretch">
          <ContributionAdvice items={data.contributionAdvice} />
          <ProfileOptimizations optimizations={data.profileOptimizations} />
        </div>
        <ActionPlan actionPlan={data.actionPlan} />
      </div>
      <AdviceExportBar
        username={username}
        adviceRef={adviceRef}
        onBeforeExport={() => setPdfMode(true)}
        onAfterExport={() => setPdfMode(false)}
      />
    </div>
  );
}
