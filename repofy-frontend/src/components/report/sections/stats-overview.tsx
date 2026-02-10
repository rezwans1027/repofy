import { useMemo } from "react";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import { CountUp } from "@/components/ui/count-up";
import type { ReportData } from "@/components/report/analysis-report";

interface StatsOverviewProps {
  stats: ReportData["stats"];
}

export function StatsOverview({ stats }: StatsOverviewProps) {
  const statItems = useMemo(
    () => [
      { label: "Repositories", value: stats.repos },
      { label: "Total Stars", value: stats.stars },
      { label: "Followers", value: stats.followers },
      { label: "Contributions", value: stats.contributions },
    ],
    [stats.repos, stats.stars, stats.followers, stats.contributions],
  );

  const ratios = useMemo(
    () => [
      { label: "Stars / Repo", value: stats.starsPerRepo.toFixed(1) },
      {
        label: "Collaboration Ratio",
        value: `${(stats.collaborationRatio * 100).toFixed(0)}%`,
      },
    ],
    [stats.starsPerRepo, stats.collaborationRatio],
  );

  return (
    <AnimateOnView delay={0.18}>
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHeader title="Stats Overview" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {statItems.map((s) => (
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
          {stats.interpretation}
        </p>
      </div>
    </AnimateOnView>
  );
}
