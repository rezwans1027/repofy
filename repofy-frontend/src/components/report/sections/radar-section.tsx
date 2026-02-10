import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import { RadarChart } from "@/components/ui/radar-chart";
import type { ReportData } from "@/components/report/analysis-report";

interface RadarSectionProps {
  radarAxes: ReportData["radarAxes"];
  radarBreakdown: ReportData["radarBreakdown"];
}

export function RadarSection({ radarAxes, radarBreakdown }: RadarSectionProps) {
  return (
    <AnimateOnView delay={0.12}>
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHeader
          title="Developer DNA"
          subtitle="6-axis capability assessment"
        />
        <div className="grid gap-6 lg:grid-cols-2">
          <RadarChart data={radarAxes} size={300} />
          <div className="space-y-3">
            {radarBreakdown.map((item) => (
              <div key={item.label} className="space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs">{item.label}</span>
                  <span className="font-mono text-xs text-cyan">
                    {item.score}/10
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">{item.note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AnimateOnView>
  );
}
