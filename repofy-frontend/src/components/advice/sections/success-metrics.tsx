import { Target } from "lucide-react";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";

interface SuccessMetricsProps {
  metrics: string[];
}

export function SuccessMetrics({ metrics }: SuccessMetricsProps) {
  if (metrics.length === 0) {
    return (
      <AnimateOnView delay={0.24}>
        <div className="rounded-lg border border-border bg-card p-5">
          <SectionHeader title="Success Metrics" />
          <p className="text-xs text-muted-foreground">No success metrics available.</p>
        </div>
      </AnimateOnView>
    );
  }

  return (
    <AnimateOnView delay={0.24}>
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHeader
          title="Success Metrics"
          subtitle="Measurable checkpoints for your 12-week plan"
        />
        <div className="space-y-2">
          {metrics.map((metric, i) => (
            <div key={i} className="flex gap-3 rounded-md border border-border bg-background p-3">
              <Target className="size-4 shrink-0 text-emerald-400 mt-0.5" />
              <p className="text-xs leading-relaxed">{metric}</p>
            </div>
          ))}
        </div>
      </div>
    </AnimateOnView>
  );
}
