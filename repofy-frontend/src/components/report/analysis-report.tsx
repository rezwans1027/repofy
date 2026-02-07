"use client";

import { createContext, useContext, useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  AlertTriangle,
  AlertCircle,
  ChevronDown,
  Award,
  FileDown,
  Link2,
  SlidersHorizontal,
  Star,
  GitFork,
} from "lucide-react";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { RadarChart } from "@/components/ui/radar-chart";
import { CountUp } from "@/components/ui/count-up";
import { SectionHeader } from "@/components/ui/section-header";
import { MetricBar } from "@/components/ui/metric-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { reportData as staticReportData, demoProfile } from "@/lib/demo-data";

export type ReportData = typeof staticReportData;
const ReportDataContext = createContext<ReportData>(staticReportData);
function useReportData() {
  return useContext(ReportDataContext);
}

interface AnalysisReportProps {
  username: string;
  avatarUrl?: string;
  data?: ReportData;
}

// ── Section 1: Top Banner ──────────────────────────────────────────

function TopBanner({ username, avatarUrl }: { username: string; avatarUrl?: string }) {
  const reportData = useReportData();
  const scoreColor =
    reportData.overallScore >= 80
      ? "text-emerald-400"
      : reportData.overallScore >= 60
        ? "text-yellow-400"
        : "text-red-400";

  const recColor =
    reportData.recommendation === "Strong Hire"
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
      : "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";

  return (
    <AnimateOnView>
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: avatar + info */}
          <div className="flex items-center gap-4">
            <div className="relative">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={username}
                  className="h-16 w-16 rounded-full border-2 border-cyan/30"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-cyan/30 bg-secondary font-mono text-xl font-bold text-cyan">
                  {username.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <h1 className="font-mono text-lg font-bold tracking-tight">
                @{username}
              </h1>
              <p className="font-mono text-sm text-muted-foreground">
                Developer Report
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <Badge className="bg-cyan/15 text-cyan border border-cyan/30 text-[10px]">
                  {reportData.candidateLevel}
                </Badge>
                <Badge className={`border text-[10px] ${recColor}`}>
                  {reportData.recommendation}
                </Badge>
              </div>
            </div>
          </div>

          {/* Right: score ring */}
          <div className="flex items-center gap-3 sm:flex-col sm:items-end">
            <div className="relative flex h-20 w-20 items-center justify-center">
              <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90">
                <circle
                  cx="50" cy="50" r="42"
                  fill="none"
                  stroke="var(--secondary)"
                  strokeWidth="6"
                />
                <motion.circle
                  cx="50" cy="50" r="42"
                  fill="none"
                  stroke="#22D3EE"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                  animate={{
                    strokeDashoffset:
                      2 * Math.PI * 42 * (1 - reportData.overallScore / 100),
                  }}
                  transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
                />
              </svg>
              <span className={`font-mono text-xl font-bold ${scoreColor}`}>
                <CountUp end={reportData.overallScore} />
              </span>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              Overall Score
            </span>
          </div>
        </div>
      </div>
    </AnimateOnView>
  );
}

// ── Section 2: Summary ─────────────────────────────────────────────

function Summary() {
  const reportData = useReportData();
  return (
    <AnimateOnView delay={0.05}>
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHeader title="Executive Summary" />
        <div className="border-l-2 border-cyan/40 pl-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {reportData.summary}
          </p>
        </div>
      </div>
    </AnimateOnView>
  );
}

// ── Section 3: Radar Chart ─────────────────────────────────────────

function RadarSection() {
  const reportData = useReportData();
  return (
    <AnimateOnView delay={0.05}>
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHeader
          title="Developer DNA"
          subtitle="6-axis capability assessment"
        />
        <div className="grid gap-6 lg:grid-cols-2">
          <RadarChart data={reportData.radarAxes} size={300} />
          <div className="space-y-3">
            {reportData.radarBreakdown.map((item) => (
              <div key={item.label} className="space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs">{item.label}</span>
                  <span className="font-mono text-xs text-cyan">
                    {item.score}/10
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">{item.note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AnimateOnView>
  );
}

// ── Section 4: Stats Overview ──────────────────────────────────────

function StatsOverview() {
  const reportData = useReportData();
  const stats = [
    { label: "Repositories", value: reportData.stats.repos },
    { label: "Total Stars", value: reportData.stats.stars },
    { label: "Followers", value: reportData.stats.followers },
    { label: "Contributions", value: reportData.stats.contributions },
  ];

  const ratios = [
    { label: "Stars / Repo", value: reportData.stats.starsPerRepo.toFixed(1) },
    {
      label: "Collaboration Ratio",
      value: `${(reportData.stats.collaborationRatio * 100).toFixed(0)}%`,
    },
  ];

  return (
    <AnimateOnView delay={0.05}>
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHeader title="Stats Overview" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-md border border-border bg-background p-3 text-center"
            >
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {s.label}
              </p>
              <p className="mt-1 font-mono text-lg font-bold">
                <CountUp end={s.value} />
              </p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-3">
          {ratios.map((r) => (
            <div
              key={r.label}
              className="flex-1 rounded-md border border-border bg-background p-3 text-center"
            >
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {r.label}
              </p>
              <p className="mt-1 font-mono text-sm font-bold text-cyan">
                {r.value}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          {reportData.stats.interpretation}
        </p>
      </div>
    </AnimateOnView>
  );
}

// ── Section 5: Activity Breakdown ──────────────────────────────────

function ActivityBreakdown() {
  const reportData = useReportData();
  const segments = [
    { label: "Push", pct: reportData.activityBreakdown.push, color: "#22D3EE" },
    { label: "PR", pct: reportData.activityBreakdown.pr, color: "#A78BFA" },
    { label: "Issue", pct: reportData.activityBreakdown.issue, color: "#FBBF24" },
    { label: "Review", pct: reportData.activityBreakdown.review, color: "#34D399" },
  ];

  return (
    <AnimateOnView delay={0.05}>
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHeader title="Activity Breakdown" />
        {/* Stacked bar */}
        <div className="flex h-6 w-full overflow-hidden rounded-full">
          {segments.map((seg) => (
            <motion.div
              key={seg.label}
              className="h-full"
              style={{ backgroundColor: seg.color }}
              initial={{ width: 0 }}
              whileInView={{ width: `${seg.pct}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          ))}
        </div>
        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-4">
          {segments.map((seg) => (
            <div key={seg.label} className="flex items-center gap-1.5">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: seg.color }}
              />
              <span className="font-mono text-xs text-muted-foreground">
                {seg.label} {seg.pct}%
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {reportData.activityBreakdown.interpretation}
        </p>
      </div>
    </AnimateOnView>
  );
}

// ── Section 6: Language Profile ─────────────────────────────────────

function LanguageProfile() {
  const reportData = useReportData();
  const langs = reportData.languageProfile.languages;

  return (
    <AnimateOnView delay={0.05}>
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHeader title="Language Profile" />
        {/* Stacked bar */}
        <div className="flex h-5 w-full overflow-hidden rounded-full">
          {langs.map((lang) => (
            <motion.div
              key={lang.name}
              className="h-full"
              style={{ backgroundColor: lang.color }}
              initial={{ width: 0 }}
              whileInView={{ width: `${lang.percentage}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          ))}
        </div>
        {/* Detail rows */}
        <div className="mt-4 space-y-2">
          {langs.map((lang) => (
            <div key={lang.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: lang.color }}
                />
                <span className="font-mono text-xs">{lang.name}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-mono text-[10px] text-muted-foreground">
                  {lang.repos} repos
                </span>
                <span className="font-mono text-xs text-cyan w-8 text-right">
                  {lang.percentage}%
                </span>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          {reportData.languageProfile.interpretation}
        </p>
      </div>
    </AnimateOnView>
  );
}

// ── Section 7: Top Repos ────────────────────────────────────────────

function TopRepos() {
  const reportData = useReportData();
  const [expanded, setExpanded] = useState<string | null>(null);

  const gradeColor = (grade: string) => {
    if (grade.startsWith("A")) return "text-emerald-400";
    if (grade.startsWith("B")) return "text-cyan";
    if (grade.startsWith("C")) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <AnimateOnView delay={0.05}>
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHeader
          title="Top Repositories"
          subtitle="Deep dive into signature projects"
        />
        <div className="space-y-3">
          {reportData.topRepos.map((repo) => (
            <div
              key={repo.name}
              className="rounded-md border border-border bg-background overflow-hidden"
            >
              <button
                onClick={() =>
                  setExpanded(expanded === repo.name ? null : repo.name)
                }
                className="flex w-full items-center justify-between p-3 text-left hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-sm font-bold truncate">
                    {repo.name}
                  </span>
                  {repo.isBestWork && (
                    <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[9px] shrink-0">
                      <Award className="size-2.5" />
                      Best Work
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                    <Star className="size-3" />
                    {repo.stars}
                  </span>
                  <ChevronDown
                    className={`size-4 text-muted-foreground transition-transform ${
                      expanded === repo.name ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </button>

              {expanded === repo.name && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  transition={{ duration: 0.25 }}
                  className="border-t border-border"
                >
                  <div className="p-4 space-y-3">
                    <p className="text-xs text-muted-foreground">
                      {repo.description}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {repo.topics.map((t) => (
                        <Badge
                          key={t}
                          variant="secondary"
                          className="text-[10px]"
                        >
                          {t}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <div
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: repo.languageColor }}
                        />
                        {repo.language}
                      </span>
                      <span className="flex items-center gap-1">
                        <Star className="size-3" /> {repo.stars}
                      </span>
                      <span className="flex items-center gap-1">
                        <GitFork className="size-3" /> {repo.forks}
                      </span>
                    </div>
                    {/* Grades */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "Code Quality", grade: repo.codeQuality },
                        { label: "Testing", grade: repo.testing },
                        { label: "CI/CD", grade: repo.cicd },
                      ].map((g) => (
                        <div
                          key={g.label}
                          className="rounded-md border border-border p-2 text-center"
                        >
                          <p className="font-mono text-[10px] text-muted-foreground">
                            {g.label}
                          </p>
                          <p
                            className={`mt-0.5 font-mono text-sm font-bold ${gradeColor(g.grade)}`}
                          >
                            {g.grade}
                          </p>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground border-l-2 border-cyan/30 pl-3">
                      {repo.verdict}
                    </p>
                  </div>
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </div>
    </AnimateOnView>
  );
}

// ── Section 8: Strengths ────────────────────────────────────────────

function Strengths() {
  const reportData = useReportData();
  return (
    <AnimateOnView delay={0.05} className="h-full">
      <div className="rounded-lg border border-border bg-card p-5 h-full">
        <SectionHeader title="Strengths" />
        <div className="space-y-3">
          {reportData.strengths.map((s, i) => (
            <div key={i} className="flex gap-3">
              <Check className="size-4 shrink-0 text-emerald-400 mt-0.5" />
              <div>
                <p className="text-sm">{s.text}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {s.evidence}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AnimateOnView>
  );
}

// ── Section 9: Weaknesses ───────────────────────────────────────────

function Weaknesses() {
  const reportData = useReportData();
  return (
    <AnimateOnView delay={0.05} className="h-full">
      <div className="rounded-lg border border-border bg-card p-5 h-full">
        <SectionHeader title="Areas for Improvement" />
        <div className="space-y-3">
          {reportData.weaknesses.map((w, i) => (
            <div key={i} className="flex gap-3">
              <AlertTriangle className="size-4 shrink-0 text-yellow-400 mt-0.5" />
              <div>
                <p className="text-sm">{w.text}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {w.evidence}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AnimateOnView>
  );
}

// ── Section 10: Red Flags ───────────────────────────────────────────

function RedFlags() {
  const reportData = useReportData();
  const severityStyle = {
    Minor: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    Notable: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    Concerning: "bg-red-500/15 text-red-400 border-red-500/30",
  };

  return (
    <AnimateOnView delay={0.05}>
      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-5">
        <SectionHeader title="Red Flags" />
        <div className="space-y-3">
          {reportData.redFlags.map((flag, i) => (
            <div key={i} className="flex gap-3">
              <AlertCircle className="size-4 shrink-0 text-orange-400 mt-0.5" />
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm">{flag.text}</p>
                  <Badge
                    className={`border text-[9px] shrink-0 ${severityStyle[flag.severity]}`}
                  >
                    {flag.severity}
                  </Badge>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {flag.explanation}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AnimateOnView>
  );
}

// ── Section 11: Interview Questions ─────────────────────────────────

function InterviewQuestions() {
  const reportData = useReportData();
  return (
    <AnimateOnView delay={0.05}>
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHeader
          title="Suggested Interview Questions"
          subtitle="Tailored to this candidate's profile"
        />
        <div className="space-y-0 divide-y divide-border">
          {reportData.interviewQuestions.map((q, i) => (
            <div
              key={i}
              className={`py-3 ${i % 2 === 0 ? "bg-transparent" : "bg-secondary/20"} ${i === 0 ? "pt-0" : ""}`}
            >
              <p className="text-sm">
                <span className="font-mono text-cyan mr-2">{i + 1}.</span>
                {q.question}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground ml-5">
                ({q.why})
              </p>
            </div>
          ))}
        </div>
      </div>
    </AnimateOnView>
  );
}

// ── Section 12: Export Bar ──────────────────────────────────────────

function ExportBar({ username }: { username: string }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 lg:left-48 z-50 border-t border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <p className="hidden font-mono text-xs text-muted-foreground sm:block">
          Report generated for{" "}
          <span className="text-cyan">@{username}</span>
        </p>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            size="sm"
            className="bg-cyan text-background hover:bg-cyan/90 font-mono text-xs flex-1 sm:flex-initial"
          >
            <FileDown className="size-3.5" />
            Export PDF
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="font-mono text-xs flex-1 sm:flex-initial"
          >
            <Link2 className="size-3.5" />
            Share Link
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="font-mono text-xs flex-1 sm:flex-initial opacity-50 cursor-not-allowed"
            disabled
          >
            <SlidersHorizontal className="size-3.5" />
            Role Filter
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Report Component ───────────────────────────────────────────

export function AnalysisReport({ username, avatarUrl, data }: AnalysisReportProps) {
  return (
    <ReportDataContext.Provider value={data ?? staticReportData}>
      <div className="space-y-4 pb-20">
        <TopBanner username={username} avatarUrl={avatarUrl} />
        <Summary />
        <RadarSection />
        <StatsOverview />
        <ActivityBreakdown />
        <LanguageProfile />
        <TopRepos />
        <div className="grid gap-4 lg:grid-cols-2 items-stretch">
          <Strengths />
          <Weaknesses />
        </div>
        <RedFlags />
        <InterviewQuestions />
        <ExportBar username={username} />
      </div>
    </ReportDataContext.Provider>
  );
}
