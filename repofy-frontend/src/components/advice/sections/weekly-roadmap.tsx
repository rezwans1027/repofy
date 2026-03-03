import { Calendar, CheckCircle2 } from "lucide-react";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import { Badge } from "@/components/ui/badge";
import type { AdviceData } from "@/components/advice/advice-report";

const BUILD_COLORS = [
  { bg: "bg-emerald-500/10", border: "border-emerald-400/30", text: "text-emerald-400" },
  { bg: "bg-cyan/10", border: "border-cyan/30", text: "text-cyan" },
  { bg: "bg-purple-500/10", border: "border-purple-400/30", text: "text-purple-400" },
];

interface WeeklyRoadmapProps {
  weeks: AdviceData["weeklyRoadmap"];
  builds: AdviceData["buildRoadmap"];
}

export function WeeklyRoadmap({ weeks, builds }: WeeklyRoadmapProps) {
  if (weeks.length === 0) {
    return (
      <AnimateOnView delay={0.18}>
        <div className="rounded-lg border border-border bg-card p-5">
          <SectionHeader title="12-Week Roadmap" />
          <p className="text-xs text-muted-foreground">No weekly roadmap available.</p>
        </div>
      </AnimateOnView>
    );
  }

  const buildTitleIndex = new Map(builds.map((b, i) => [b.title, i]));

  return (
    <AnimateOnView delay={0.18}>
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHeader
          title="12-Week Roadmap"
          subtitle="Your week-by-week execution plan"
        />
        <div className="space-y-2">
          {weeks.map((week) => {
            const buildIdx = buildTitleIndex.get(week.activeBuildTitle) ?? 0;
            const color = BUILD_COLORS[buildIdx % BUILD_COLORS.length];

            return (
              <div
                key={week.week}
                className={`rounded-md border ${color.border} ${color.bg} p-3 space-y-2`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Calendar className={`size-3.5 shrink-0 ${color.text}`} />
                    <span className={`font-mono text-xs font-bold ${color.text}`}>
                      W{week.week}
                    </span>
                    <Badge variant="secondary" className="text-[9px]">
                      {week.activeBuildTitle}
                    </Badge>
                  </div>
                </div>

                <p className="text-xs font-medium">{week.focus}</p>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Tasks</span>
                    <ul className="mt-0.5 space-y-0.5">
                      {week.tasks.map((t, i) => (
                        <li key={i} className="text-[11px] text-muted-foreground flex gap-1.5">
                          <span className={`${color.text} shrink-0`}>•</span>
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-1">
                    <div>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Skill Task</span>
                      <p className="text-[11px] text-muted-foreground">{week.skillTask}</p>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <CheckCircle2 className={`size-3 shrink-0 mt-0.5 ${color.text}`} />
                      <p className="text-[11px] text-muted-foreground">{week.successCheck}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AnimateOnView>
  );
}
