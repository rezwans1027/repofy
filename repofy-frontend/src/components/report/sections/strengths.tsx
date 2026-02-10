import { Check } from "lucide-react";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import type { ReportData } from "@/components/report/analysis-report";

interface StrengthsProps {
  strengths: ReportData["strengths"];
}

export function Strengths({ strengths }: StrengthsProps) {
  return (
    <AnimateOnView delay={0.42} className="h-full">
      <div className="rounded-lg border border-border bg-card p-5 h-full">
        <SectionHeader title="Strengths" />
        <div className="space-y-3">
          {strengths.map((s) => (
            <div key={s.text} className="flex gap-3">
              <Check className="size-4 shrink-0 text-emerald-400 mt-0.5" />
              <div>
                <p className="text-sm">{s.text}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {s.evidence}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AnimateOnView>
  );
}
