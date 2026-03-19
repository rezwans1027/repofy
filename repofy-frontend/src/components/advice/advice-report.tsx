"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";

import { AdviceTopBanner } from "./sections/advice-top-banner";
import { AdviceSummary } from "./sections/advice-summary";
import { TrajectorySection } from "./sections/trajectory";
import { BuildRoadmap } from "./sections/build-roadmap";
import { WeeklyRoadmap } from "./sections/weekly-roadmap";
import { SuccessMetrics } from "./sections/success-metrics";
import { SkillRoadmap } from "./sections/skill-roadmap";
import { RepoImprovements } from "./sections/repo-improvements";
import { ContributionStrategy } from "./sections/contribution-strategy";
import { ProfileOptimizations } from "./sections/profile-optimizations";
import { StrengthsAndGaps } from "./sections/strengths-and-gaps";
import { CareerPositioning } from "./sections/career-positioning";
import { AdviceExportBar } from "./sections/advice-export-bar";
import { tabContentVariants, EASE_OUT_EXPO } from "@/lib/animation-variants";
import type { AdviceData, GenerationWarning } from "@shared/types/advice";

const AdviceReportPdfLayout = dynamic(
  () => import("./advice-pdf-layout").then((m) => ({ default: m.AdviceReportPdfLayout })),
  { ssr: false }
);

export type { AdviceData, GenerationWarning };

// ── Warning system ──────────────────────────────────────────────────

const WARNING_MESSAGES: Record<GenerationWarning, string> = {
  repo_improvements_unavailable: "Repo improvement suggestions could not be generated for this profile.",
  repo_improvements_reduced: "Some repo improvements were removed due to unrecognized repository names.",
  weekly_roadmap_synthesized: "The weekly roadmap was auto-generated from your build milestones.",
  success_metrics_reduced: "Some success metrics were refined for measurability.",
  profile_optimizations_reduced: "Some profile optimization suggestions were removed.",
  skill_roadmap_reduced: "Some skill suggestions were removed as they overlap with your existing stack.",
  contribution_strategy_reduced: "Some contribution strategy items were removed.",
  strengths_and_gaps_reduced: "Strengths and gaps analysis could not be fully generated.",
  career_positioning_reduced: "Career positioning could not be fully generated.",
};

// ── Tabs ────────────────────────────────────────────────────────────

const TABS = [
  { key: "career", label: "Career Direction" },
  { key: "build", label: "Build Plan" },
  { key: "improve", label: "Improve" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const TAB_INDEX: Record<TabKey, number> = { career: 0, build: 1, improve: 2 };

// ── Component ───────────────────────────────────────────────────────

interface AdviceReportProps {
  username: string;
  avatarUrl?: string;
  data: AdviceData;
}

export function AdviceReport({ username, avatarUrl, data }: AdviceReportProps) {
  const pdfRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("career");
  const [direction, setDirection] = useState(0);

  const warnings = data.generationWarnings ?? [];

  const handleTabChange = (tab: TabKey) => {
    setHasInteracted(true);
    const d = TAB_INDEX[tab] - TAB_INDEX[activeTab];
    setDirection(d > 0 ? 1 : -1);
    setActiveTab(tab);
  };

  return (
    <div className="space-y-4 pb-20">
      <div className="space-y-4">
        <AdviceTopBanner username={username} avatarUrl={avatarUrl} />

        {/* Warning banner */}
        {warnings.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease: EASE_OUT_EXPO }}
            className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="size-4 shrink-0 text-yellow-400 mt-0.5" />
              <div className="space-y-1">
                {warnings.map((w) => (
                  <p key={w} className="text-xs text-yellow-400/80">
                    {WARNING_MESSAGES[w] ?? w}
                  </p>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Tab navigation */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: EASE_OUT_EXPO }}
          className="sticky top-0 z-10 -mx-1 px-1 pt-1 pb-2 bg-background/80 backdrop-blur-lg border-b border-border"
        >
          <div className="flex gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`relative shrink-0 rounded-md px-4 py-2 font-mono text-xs font-medium ${
                  activeTab === tab.key
                    ? "text-emerald-400"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                {activeTab === tab.key && (
                  <motion.span
                    layoutId="advice-tab-indicator"
                    className="absolute inset-0 rounded-md bg-emerald-500/15 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.12)]"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                  />
                )}
                <span className="relative z-[1]">{tab.label}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Tab content with directional slide + crossfade */}
        <AnimatePresence mode="wait" custom={hasInteracted ? direction : null}>
          {activeTab === "career" && (
            <motion.div
              key="career"
              custom={hasInteracted ? direction : null}
              variants={tabContentVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="space-y-4"
              data-tab="career"
            >
              <AdviceSummary summary={data.summary} />
              <TrajectorySection trajectory={data.trajectory} />
              <StrengthsAndGaps data={data.strengthsAndGaps} />
              <CareerPositioning data={data.careerPositioning} />
            </motion.div>
          )}

          {activeTab === "build" && (
            <motion.div
              key="build"
              custom={hasInteracted ? direction : null}
              variants={tabContentVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="space-y-4"
              data-tab="build"
            >
              <BuildRoadmap builds={data.buildRoadmap} />
              <WeeklyRoadmap weeks={data.weeklyRoadmap} builds={data.buildRoadmap} />
              <SuccessMetrics metrics={data.successMetrics} />
            </motion.div>
          )}

          {activeTab === "improve" && (
            <motion.div
              key="improve"
              custom={hasInteracted ? direction : null}
              variants={tabContentVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="space-y-4"
              data-tab="improve"
            >
              <RepoImprovements repoImprovements={data.repoImprovements} expandAll={false} />
              <SkillRoadmap skills={data.skillRoadmap} />
              <ContributionStrategy items={data.contributionStrategy} />
              <ProfileOptimizations optimizations={data.profileOptimizations} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Off-screen PDF layout — only mounted during export */}
      {exporting && (
        <div
          aria-hidden="true"
          className="fixed pointer-events-none"
          style={{ left: "-200vw", top: 0 }}
        >
          <div ref={pdfRef} data-pdf-target className="w-[900px]">
            <AdviceReportPdfLayout username={username} data={data} />
          </div>
        </div>
      )}

      <AdviceExportBar
        username={username}
        adviceRef={pdfRef}
        onBeforeExport={() => setExporting(true)}
        onAfterExport={() => setExporting(false)}
      />
    </div>
  );
}
