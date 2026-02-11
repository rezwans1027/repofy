import { Calendar, ArrowUpRight } from "lucide-react";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import type { AdviceData } from "@/components/advice/advice-report";

const TIMEFRAME_STYLES = {
  "30 days": { color: "text-emerald-400", border: "border-emerald-400/30", bg: "bg-emerald-500/10" },
  "60 days": { color: "text-yellow-400", border: "border-yellow-400/30", bg: "bg-yellow-500/10" },
  "90 days": { color: "text-purple-400", border: "border-purple-400/30", bg: "bg-purple-500/10" },
} as const;

interface ActionPlanProps {
  actionPlan: AdviceData["actionPlan"];
}

export function ActionPlan({ actionPlan }: ActionPlanProps) {
  return (
    <AnimateOnView delay={0.36}>
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHeader
          title="Action Plan"
          subtitle="Your 30-60-90 day roadmap"
        />
        <div className="grid gap-3 lg:grid-cols-3">
          {actionPlan.map((phase) => {
            const style = TIMEFRAME_STYLES[phase.timeframe];
            return (
              <div
                key={phase.timeframe}
                className={`rounded-md border ${style.border} ${style.bg} p-4 space-y-3`}
              >
                <div className="flex items-center gap-2">
                  <Calendar className={`size-4 ${style.color}`} />
                  <h3 className={`font-mono text-sm font-bold ${style.color}`}>
                    {phase.timeframe}
                  </h3>
                </div>
                <div className="space-y-2">
                  {phase.actions.map((action) => (
                    <div key={action} className="flex gap-2">
                      <ArrowUpRight className={`size-3 shrink-0 mt-0.5 ${style.color}`} />
                      <p className="text-xs leading-relaxed">{action}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AnimateOnView>
  );
}
