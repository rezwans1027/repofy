"use client";

import { ReactNode } from "react";
import {
  Check,
  AlertTriangle,
  AlertCircle,
  Star,
  GitFork,
  Award,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/ui/section-header";
import type { ReportData } from "@/components/report/analysis-report";
import { cn } from "@/lib/utils";

// ── Generic 2-column layout ──────────────────────────────────────

interface ComparisonSideBySideProps {
  title: string;
  subtitle?: string;
  labelA: string;
  labelB: string;
  renderA: () => ReactNode;
  renderB: () => ReactNode;
  variant?: "default" | "red-flags";
}

export function ComparisonSideBySide({
  title,
  subtitle,
  labelA,
  labelB,
  renderA,
  renderB,
  variant = "default",
}: ComparisonSideBySideProps) {
  const borderClass =
    variant === "red-flags" ? "border-red-500/20 bg-red-500/5" : "border-border bg-card";

  return (
    <div className={cn("rounded-lg border p-5", borderClass)}>
      <SectionHeader title={title} subtitle={subtitle} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-cyan mb-3">
            @{labelA}
          </p>
          {renderA()}
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-violet-400 mb-3">
            @{labelB}
          </p>
          {renderB()}
        </div>
      </div>
    </div>
  );
}

// ── Pre-built renderers ──────────────────────────────────────────

export function StrengthsList({ strengths }: { strengths: ReportData["strengths"] }) {
  return (
    <div className="space-y-3">
      {strengths.map((s, i) => (
        <div key={i} className="flex gap-3">
          <Check className="size-4 shrink-0 text-emerald-400 mt-0.5" />
          <div>
            <p className="text-sm">{s.text}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{s.evidence}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function WeaknessesList({ weaknesses }: { weaknesses: ReportData["weaknesses"] }) {
  return (
    <div className="space-y-3">
      {weaknesses.map((w, i) => (
        <div key={i} className="flex gap-3">
          <AlertTriangle className="size-4 shrink-0 text-yellow-400 mt-0.5" />
          <div>
            <p className="text-sm">{w.text}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{w.evidence}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function RedFlagsList({ redFlags }: { redFlags: ReportData["redFlags"] }) {
  const severityStyle: Record<string, string> = {
    Minor: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    Notable: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    Concerning: "bg-red-500/15 text-red-400 border-red-500/30",
  };

  return (
    <div className="space-y-3">
      {redFlags.map((flag, i) => (
        <div key={i} className="flex gap-3">
          <AlertCircle className="size-4 shrink-0 text-orange-400 mt-0.5" />
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm">{flag.text}</p>
              <Badge
                className={`border text-[9px] shrink-0 ${severityStyle[flag.severity] ?? ""}`}
              >
                {flag.severity}
              </Badge>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">{flag.explanation}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function InterviewQuestionsList({
  questions,
}: {
  questions: ReportData["interviewQuestions"];
}) {
  return (
    <div className="space-y-0 divide-y divide-border">
      {questions.map((q, i) => (
        <div
          key={i}
          className={cn("py-3", i % 2 === 0 ? "bg-transparent" : "bg-secondary/20", i === 0 && "pt-0")}
        >
          <p className="text-sm">
            <span className="font-mono text-cyan mr-2">{i + 1}.</span>
            {q.question}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground ml-5">({q.why})</p>
        </div>
      ))}
    </div>
  );
}

export function TopReposList({ repos }: { repos: ReportData["topRepos"] }) {
  const gradeColor = (grade: string) => {
    if (grade.startsWith("A")) return "text-emerald-400";
    if (grade.startsWith("B")) return "text-cyan";
    if (grade.startsWith("C")) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <div className="space-y-3">
      {repos.map((repo) => (
        <div key={repo.name} className="rounded-md border border-border bg-background p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold">{repo.name}</span>
            {repo.isBestWork && (
              <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[9px] shrink-0">
                <Award className="size-2.5" />
                Best Work
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{repo.description}</p>
          <div className="flex flex-wrap gap-1.5">
            {repo.topics.map((t) => (
              <Badge key={t} variant="secondary" className="text-[10px]">
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
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Code Quality", grade: repo.codeQuality },
              { label: "Testing", grade: repo.testing },
              { label: "CI/CD", grade: repo.cicd },
            ].map((g) => (
              <div key={g.label} className="rounded-md border border-border p-2 text-center">
                <p className="font-mono text-[10px] text-muted-foreground">{g.label}</p>
                <p className={`mt-0.5 font-mono text-sm font-bold ${gradeColor(g.grade)}`}>
                  {g.grade}
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground border-l-2 border-cyan/30 pl-3">
            {repo.verdict}
          </p>
        </div>
      ))}
    </div>
  );
}
