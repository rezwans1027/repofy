import { Target } from "lucide-react";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import type { AdviceData } from "@/components/advice/advice-report";

interface ProfileOptimizationsProps {
  optimizations: AdviceData["profileOptimizations"];
}

export function ProfileOptimizations({ optimizations }: ProfileOptimizationsProps) {
  return (
    <AnimateOnView delay={0.3} className="h-full">
      <div className="rounded-lg border border-border bg-card p-5 h-full">
        <SectionHeader title="Profile Optimizations" />
        <div className="space-y-3">
          {optimizations.map((opt) => (
            <div
              key={opt.area}
              className="rounded-md border border-border bg-background p-3 space-y-2"
            >
              <div className="flex items-center gap-2">
                <Target className="size-3.5 shrink-0 text-emerald-400" />
                <span className="font-mono text-xs font-bold">{opt.area}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Current
                  </span>
                  <p className="mt-0.5 text-muted-foreground">{opt.current}</p>
                </div>
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-400">
                    Suggestion
                  </span>
                  <p className="mt-0.5">{opt.suggestion}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AnimateOnView>
  );
}
