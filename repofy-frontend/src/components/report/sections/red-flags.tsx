import { AlertCircle } from "lucide-react";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import { Badge } from "@/components/ui/badge";
import { SEVERITY_STYLES } from "@/lib/styles";
import type { ReportData } from "@/components/report/analysis-report";

interface RedFlagsProps {
  redFlags: ReportData["redFlags"];
}

export function RedFlags({ redFlags }: RedFlagsProps) {
  return (
    <AnimateOnView delay={0.48}>
      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-5">
        <SectionHeader title="Red Flags" />
        <div className="space-y-3">
          {redFlags.map((flag) => (
            <div key={flag.text} className="flex gap-3">
              <AlertCircle className="size-4 shrink-0 text-orange-400 mt-0.5" />
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm">{flag.text}</p>
                  <Badge
                    className={`border text-[9px] shrink-0 ${SEVERITY_STYLES[flag.severity] ?? ""}`}
                  >
                    {flag.severity}
                  </Badge>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {flag.explanation}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AnimateOnView>
  );
}
