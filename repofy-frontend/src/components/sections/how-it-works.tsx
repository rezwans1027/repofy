"use client";

import { SectionHeader } from "@/components/ui/section-header";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { TerminalWindow } from "@/components/ui/terminal-window";
import { DiffBlock } from "@/components/ui/diff-block";
import { Search, Cpu, ClipboardCheck } from "lucide-react";

const diffLines = {
  old: [
    { type: "remove" as const, text: "- Read 200 resumes" },
    { type: "remove" as const, text: "- Guess from job titles" },
    { type: "remove" as const, text: '- "5 years of React"' },
    { type: "remove" as const, text: "- Hope for the best" },
  ],
  new: [
    { type: "add" as const, text: "+ Analyze actual code" },
    { type: "add" as const, text: "+ Measure real patterns" },
    { type: "add" as const, text: "+ See commit discipline" },
    { type: "add" as const, text: "+ Hire with confidence" },
  ],
};

const steps = [
  {
    step: "01",
    icon: Search,
    title: "Search",
    desc: "Type any GitHub username. We fetch their entire public profile — repos, commits, events, languages, and contribution history.",
  },
  {
    step: "02",
    icon: Cpu,
    title: "Analyze",
    desc: "AI processes the data to generate a hiring-grade evaluation or personalized career advice. Every insight backed by real code.",
  },
  {
    step: "03",
    icon: ClipboardCheck,
    title: "Decide",
    desc: "Get a scored report, compare candidates side-by-side, or export a PDF. All your analyses are saved and searchable.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20">
      <AnimateOnView>
        <SectionHeader
          title="How It Works"
          subtitle="From GitHub username to hiring decision in seconds."
        />
      </AnimateOnView>

      {/* Diff block */}
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

      {/* Steps */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {steps.map((item, i) => (
          <AnimateOnView key={item.step} delay={0.2 + i * 0.1}>
            <div className="h-full rounded-lg border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <span className="text-cyan font-mono text-xs">{item.step}</span>
                <item.icon className="h-4 w-4 text-cyan" />
              </div>
              <h3 className="mt-3 font-mono text-sm font-bold">{item.title}</h3>
              <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                {item.desc}
              </p>
            </div>
          </AnimateOnView>
        ))}
      </div>
    </section>
  );
}
