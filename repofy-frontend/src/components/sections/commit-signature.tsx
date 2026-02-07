"use client";

import { useMemo } from "react";
import { generateHeatmapData, commitInsights, commitVerbs } from "@/lib/demo-data";
import { SectionHeader } from "@/components/ui/section-header";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { HeatmapGrid } from "@/components/ui/heatmap-grid";
import { Badge } from "@/components/ui/badge";

export function CommitSignature() {
  const heatmapData = useMemo(() => generateHeatmapData(), []);
  const maxWeight = Math.max(...commitVerbs.map((v) => v.weight));

  return (
    <section id="commit-signature" className="py-20">
      <AnimateOnView>
        <SectionHeader
          title="Commit Signature"
          subtitle="How they ship, not just what they ship."
        />
      </AnimateOnView>

      {/* Heatmap */}
      <AnimateOnView delay={0.1}>
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-muted-foreground mb-4 font-mono text-xs">
            Contribution heatmap — 52 weeks
          </p>
          <HeatmapGrid data={heatmapData} />
          <div className="mt-3 flex items-center justify-end gap-1">
            <span className="text-muted-foreground text-[10px]">Less</span>
            {["var(--secondary)", "#064E3B", "#065F46", "#047857", "#22D3EE"].map(
              (color, i) => (
                <div
                  key={i}
                  className="h-2.5 w-2.5 rounded-[2px]"
                  style={{ backgroundColor: color }}
                />
              )
            )}
            <span className="text-muted-foreground text-[10px]">More</span>
          </div>
        </div>
      </AnimateOnView>

      {/* Insights */}
      <AnimateOnView delay={0.2}>
        <div className="mt-6 flex flex-wrap gap-2">
          {commitInsights.map((insight) => (
            <Badge
              key={insight}
              variant="outline"
              className="border-cyan/20 text-cyan font-mono text-xs"
            >
              {insight}
            </Badge>
          ))}
        </div>
      </AnimateOnView>

      {/* Word cloud */}
      <AnimateOnView delay={0.3}>
        <div className="mt-6 rounded-lg border border-border bg-card p-6">
          <p className="text-muted-foreground mb-4 font-mono text-xs">
            Commit verb frequency
          </p>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
            {commitVerbs.map((verb) => {
              const scale = 0.7 + (verb.weight / maxWeight) * 1.3;
              return (
                <span
                  key={verb.word}
                  className="font-mono transition-colors hover:text-cyan"
                  style={{
                    fontSize: `${scale}rem`,
                    opacity: 0.4 + (verb.weight / maxWeight) * 0.6,
                  }}
                >
                  {verb.word}
                </span>
              );
            })}
          </div>
        </div>
      </AnimateOnView>
    </section>
  );
}
