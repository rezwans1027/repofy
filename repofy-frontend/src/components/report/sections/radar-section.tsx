import { SectionCard } from "@/components/ui/section-card";
import { RadarChart } from "@/components/ui/radar-chart";
import type { ReportData } from "@shared/types/report";

interface RadarSectionProps {
  radarAxes: ReportData["radarAxes"];
  radarBreakdown: ReportData["radarBreakdown"];
}

export function RadarSection({ radarAxes, radarBreakdown }: RadarSectionProps) {
  return (
    <SectionCard delay={0.12} title="Developer DNA" subtitle="6-axis capability assessment" data-testid="report-radar">
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
    </SectionCard>
  );
}
