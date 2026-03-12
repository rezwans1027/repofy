"use client";

import { SectionHeader } from "@/components/ui/section-header";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { TerminalWindow } from "@/components/ui/terminal-window";
import { DiffBlock } from "@/components/ui/diff-block";
import { Search, Cpu, ClipboardCheck } from "lucide-react";

const diffLines = {
  old: [
    { type: "remove" as const, text: "- Skim GitHub profiles manually" },
    { type: "remove" as const, text: "- Guess skills from pinned repos" },
    { type: "remove" as const, text: "- Generic career advice" },
    { type: "remove" as const, text: "- No actionable next steps" },
  ],
  new: [
    { type: "add" as const, text: "+ Deep-dive any profile instantly" },
    { type: "add" as const, text: "+ AI-powered skill insights" },
    { type: "add" as const, text: "+ Personalized growth plans" },
    { type: "add" as const, text: "+ Export polished PDFs" },
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
    title: "Explore",
    desc: "Dive deep into their profile — stats, top repos, language breakdown, activity feed, and contribution patterns. All in one place.",
  },
  {
    step: "03",
    icon: ClipboardCheck,
    title: "Get Advice",
    desc: "Generate AI-powered career advice with project ideas, skills to learn, repo improvements, and a 12-week roadmap. Export as a PDF.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20">
      <AnimateOnView>
        <SectionHeader
          title="How It Works"
          subtitle="From GitHub username to actionable insights in seconds."
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
