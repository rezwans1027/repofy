import { TrendingUp } from "lucide-react";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import type { AdviceData } from "@/components/advice/advice-report";

interface ContributionAdviceProps {
  items: AdviceData["contributionAdvice"];
}

export function ContributionAdvice({ items }: ContributionAdviceProps) {
  return (
    <AnimateOnView delay={0.3} className="h-full">
      <div className="rounded-lg border border-border bg-card p-5 h-full">
        <SectionHeader title="Contribution Advice" />
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.title} className="flex gap-3">
              <TrendingUp className="size-4 shrink-0 text-emerald-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {item.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AnimateOnView>
  );
}
