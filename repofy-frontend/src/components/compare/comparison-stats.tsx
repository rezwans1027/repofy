"use client";

import { ArrowUp } from "lucide-react";
import { CountUp } from "@/components/ui/count-up";
import { SectionHeader } from "@/components/ui/section-header";
import type { ReportData } from "@/components/report/analysis-report";

interface ComparisonStatsProps {
  reportA: ReportData;
  reportB: ReportData;
  usernameA: string;
  usernameB: string;
}

export function ComparisonStats({
  reportA,
  reportB,
  usernameA,
  usernameB,
}: ComparisonStatsProps) {
  const metrics = [
    { label: "Repositories", valueA: reportA.stats.repos, valueB: reportB.stats.repos },
    { label: "Total Stars", valueA: reportA.stats.stars, valueB: reportB.stats.stars },
    { label: "Followers", valueA: reportA.stats.followers, valueB: reportB.stats.followers },
    { label: "Contributions", valueA: reportA.stats.contributions, valueB: reportB.stats.contributions },
  ];

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <SectionHeader title="Stats Comparison" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metrics.map((m) => {
          const winnerA = m.valueA > m.valueB;
          const winnerB = m.valueB > m.valueA;
          return (
            <div
              key={m.label}
              className="rounded-md border border-border bg-background p-3 text-center space-y-1"
            >
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {m.label}
              </p>
              <div className="flex items-center justify-center gap-2">
                <div className="flex items-center gap-0.5">
                  <span className="font-mono text-sm font-bold text-cyan">
                    <CountUp end={m.valueA} />
                  </span>
                  {winnerA && <ArrowUp className="size-3 text-cyan" />}
                </div>
                <span className="text-muted-foreground/40 text-xs">vs</span>
                <div className="flex items-center gap-0.5">
                  <span className="font-mono text-sm font-bold text-violet-400">
                    <CountUp end={m.valueB} />
                  </span>
                  {winnerB && <ArrowUp className="size-3 text-violet-400" />}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Ratios */}
      <div className="mt-3 flex gap-3">
        <div className="flex-1 rounded-md border border-border bg-background p-3 text-center">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Stars / Repo
          </p>
          <p className="mt-1 font-mono text-sm font-bold">
            <span className="text-cyan">{reportA.stats.starsPerRepo.toFixed(1)}</span>
            <span className="text-muted-foreground/40 mx-1.5 text-xs">vs</span>
            <span className="text-violet-400">{reportB.stats.starsPerRepo.toFixed(1)}</span>
          </p>
        </div>
        <div className="flex-1 rounded-md border border-border bg-background p-3 text-center">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Collaboration Ratio
          </p>
          <p className="mt-1 font-mono text-sm font-bold">
            <span className="text-cyan">{(reportA.stats.collaborationRatio * 100).toFixed(0)}%</span>
            <span className="text-muted-foreground/40 mx-1.5 text-xs">vs</span>
            <span className="text-violet-400">{(reportB.stats.collaborationRatio * 100).toFixed(0)}%</span>
          </p>
        </div>
      </div>
    </div>
  );
}
