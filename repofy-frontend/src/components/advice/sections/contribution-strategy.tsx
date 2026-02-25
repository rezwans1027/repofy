import { TrendingUp } from "lucide-react";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import type { AdviceData } from "@/components/advice/advice-report";

interface ContributionStrategyProps {
  items: AdviceData["contributionStrategy"];
}

export function ContributionStrategy({ items }: ContributionStrategyProps) {
  if (items.length === 0) {
    return (
      <AnimateOnView delay={0.3}>
        <div className="rounded-lg border border-border bg-card p-5">
          <SectionHeader title="Contribution Strategy" />
          <p className="text-xs text-muted-foreground">No contribution strategy available.</p>
        </div>
      </AnimateOnView>
    );
  }

  return (
    <AnimateOnView delay={0.3}>
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHeader title="Contribution Strategy" />
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.title} className="rounded-md border border-border bg-background p-3 space-y-2">
              <div className="flex gap-3">
                <TrendingUp className="size-4 shrink-0 text-emerald-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {item.detail}
                  </p>
                </div>
              </div>
              <p className="pl-7 text-[11px] text-muted-foreground italic">
                {item.evidence}
              </p>
            </div>
          ))}
        </div>
      </div>
    </AnimateOnView>
  );
}
