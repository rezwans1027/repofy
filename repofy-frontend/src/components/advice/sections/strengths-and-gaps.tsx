import { Check, AlertTriangle } from "lucide-react";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import type { AdviceData } from "@/components/advice/advice-report";

interface StrengthsAndGapsProps {
  data: AdviceData["strengthsAndGaps"];
}

export function StrengthsAndGaps({ data }: StrengthsAndGapsProps) {
  const empty = data.strengths.length === 0 && data.gaps.length === 0;

  if (empty) {
    return (
      <AnimateOnView delay={0.12}>
        <div className="rounded-lg border border-border bg-card p-5">
          <SectionHeader title="Strengths & Gaps" />
          <p className="text-xs text-muted-foreground">No strengths and gaps analysis available.</p>
        </div>
      </AnimateOnView>
    );
  }

  return (
    <AnimateOnView delay={0.12}>
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHeader
          title="Strengths & Gaps"
          subtitle="What your profile demonstrates vs what's missing"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Strengths */}
          <div className="space-y-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-400">
              Strengths
            </span>
            {data.strengths.map((s) => (
              <div key={s.area} className="flex gap-3 rounded-md border border-border bg-background p-3">
                <Check className="size-4 shrink-0 text-emerald-400 mt-0.5" />
                <div>
                  <p className="text-xs font-medium">{s.area}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{s.detail}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Gaps */}
          <div className="space-y-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-orange-400">
              Gaps
            </span>
            {data.gaps.map((g) => (
              <div key={g.area} className="flex gap-3 rounded-md border border-border bg-background p-3">
                <AlertTriangle className="size-4 shrink-0 text-orange-400 mt-0.5" />
                <div>
                  <p className="text-xs font-medium">{g.area}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{g.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AnimateOnView>
  );
}
