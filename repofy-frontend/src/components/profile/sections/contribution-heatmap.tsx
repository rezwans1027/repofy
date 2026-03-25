"use client";

import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import { HeatmapGrid } from "@/components/ui/heatmap-grid";

interface ContributionHeatmapProps {
  heatmapData: number[][] | null;
}

export function ContributionHeatmap({ heatmapData }: ContributionHeatmapProps) {
  return (
    <AnimateOnView delay={0.22}>
      <SectionHeader
        title="Contribution Activity"
        subtitle="Last 52 weeks of contributions"
      />
      <div className="rounded-lg border border-border bg-card p-4">
        {heatmapData ? (
          <>
            <HeatmapGrid data={heatmapData} />
            <div className="mt-3 flex items-center justify-end gap-1.5 text-xs text-muted-foreground font-mono" aria-hidden="true">
              <span>Less</span>
              {[0, 1, 2, 3, 4].map((level) => (
                <div
                  key={level}
                  className="h-2.5 w-2.5 rounded-[2px]"
                  style={{
                    backgroundColor:
                      [
                        "var(--secondary)",
                        "#0D9488",
                        "#14B8A6",
                        "#2DD4BF",
                        "#22D3EE",
                      ][level],
                  }}
                />
              ))}
              <span>More</span>
            </div>
            <span className="sr-only">Contribution intensity: gray means no activity, brighter teal and cyan means higher activity</span>
          </>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Contribution data unavailable — GitHub token not configured.
          </p>
        )}
      </div>
    </AnimateOnView>
  );
}
