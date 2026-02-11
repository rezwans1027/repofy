import { AlertTriangle } from "lucide-react";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import type { ReportData } from "@/components/report/analysis-report";

interface WeaknessesProps {
  weaknesses: ReportData["weaknesses"];
}

export function Weaknesses({ weaknesses }: WeaknessesProps) {
  return (
    <AnimateOnView delay={0.42} className="h-full">
      <div className="rounded-lg border border-border bg-card p-5 h-full">
        <SectionHeader title="Areas for Improvement" />
        <div className="space-y-3">
          {weaknesses.map((w) => (
            <div key={w.text} className="flex gap-3">
              <AlertTriangle className="size-4 shrink-0 text-yellow-400 mt-0.5" />
              <div>
                <p className="text-sm">{w.text}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {w.evidence}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AnimateOnView>
  );
}
