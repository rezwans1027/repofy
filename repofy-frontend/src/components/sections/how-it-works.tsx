"use client";

import { diffLines } from "@/lib/demo-data";
import { SectionHeader } from "@/components/ui/section-header";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { TerminalWindow } from "@/components/ui/terminal-window";
import { DiffBlock } from "@/components/ui/diff-block";

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20">
      <AnimateOnView>
        <SectionHeader
          title="How It Works"
          subtitle="The old way is broken."
        />
      </AnimateOnView>

      <AnimateOnView delay={0.1}>
        <TerminalWindow title="hiring.diff">
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <p className="text-muted-foreground mb-3 font-mono text-xs">
                The old way
              </p>
              <DiffBlock lines={diffLines.old} />
            </div>
            <div>
              <p className="text-cyan mb-3 font-mono text-xs">The Repofy way</p>
              <DiffBlock lines={diffLines.new} delay={0.6} />
            </div>
          </div>
        </TerminalWindow>
      </AnimateOnView>

      <AnimateOnView delay={0.3}>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            {
              step: "01",
              title: "Connect",
              desc: "Paste a GitHub username. That's it.",
            },
            {
              step: "02",
              title: "Analyze",
              desc: "We scan repos, commits, patterns, and code quality.",
            },
            {
              step: "03",
              title: "Decide",
              desc: "Get a hiring-grade evaluation in seconds.",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="rounded-lg border border-border bg-card p-4"
            >
              <span className="text-cyan font-mono text-xs">{item.step}</span>
              <h3 className="mt-2 font-mono text-sm font-bold">{item.title}</h3>
              <p className="text-muted-foreground mt-1 text-xs">{item.desc}</p>
            </div>
          ))}
        </div>
      </AnimateOnView>
    </section>
  );
}
