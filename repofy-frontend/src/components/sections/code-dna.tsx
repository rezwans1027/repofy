"use client";

import { codeDnaAxes } from "@/lib/demo-data";
import { SectionHeader } from "@/components/ui/section-header";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { RadarChart } from "@/components/ui/radar-chart";

export function CodeDna() {
  return (
    <section id="code-dna" className="py-20">
      <AnimateOnView>
        <SectionHeader
          title="Code DNA"
          subtitle="6-axis analysis of engineering practice"
        />
      </AnimateOnView>

      <AnimateOnView delay={0.1}>
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex flex-col items-center gap-8 md:flex-row">
            <div className="w-full md:w-1/2">
              <RadarChart data={codeDnaAxes} />
            </div>

            <div className="w-full space-y-4 md:w-1/2">
              <p className="text-muted-foreground text-sm">
                Patterns reveal practice. This is what we see in the code.
              </p>
              {codeDnaAxes.map((axis) => (
                <div key={axis.axis} className="flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground">
                    {axis.axis}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-cyan"
                        style={{ width: `${axis.value * 100}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs text-cyan w-8 text-right">
                      {Math.round(axis.value * 100)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </AnimateOnView>
    </section>
  );
}
