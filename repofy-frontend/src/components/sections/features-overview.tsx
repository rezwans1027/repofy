"use client";

import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import { TerminalWindow } from "@/components/ui/terminal-window";
import { Badge } from "@/components/ui/badge";
import {
  FileSearch,
  Lightbulb,
  GitCompareArrows,
  FileDown,
  Search,
  ShieldCheck,
} from "lucide-react";

const features = [
  {
    icon: Search,
    title: "GitHub Profile Explorer",
    description:
      "Search any GitHub user and explore their real stats, top repos, language breakdown, activity feed, and contribution heatmap.",
    color: "text-amber-400",
    bg: "bg-amber-400/5 border-amber-400/20",
    comingSoon: false,
  },
  {
    icon: Lightbulb,
    title: "AI Profile Advisor",
    description:
      "Generate actionable career advice: project ideas with tech stacks, skills to learn, repo improvements, profile optimizations, and a 12-week roadmap.",
    color: "text-emerald-400",
    bg: "bg-emerald-400/5 border-emerald-400/20",
    comingSoon: false,
  },
  {
    icon: FileDown,
    title: "PDF Export",
    description:
      "Export any advice plan as a polished multi-page PDF. Share with your team or save for review sessions.",
    color: "text-rose-400",
    bg: "bg-rose-400/5 border-rose-400/20",
    comingSoon: false,
  },
  {
    icon: FileSearch,
    title: "AI Developer Analysis",
    description:
      "Get a hiring-grade report with an overall score, hire recommendation, 6-axis radar chart, per-repo code grades, strengths, red flags, and tailored interview questions.",
    color: "text-cyan",
    bg: "bg-cyan/5 border-cyan/20",
    comingSoon: true,
  },
  {
    icon: GitCompareArrows,
    title: "Candidate Comparison",
    description:
      "Compare two candidates side-by-side with overlaid radar charts, stats breakdowns, language profiles, and strengths vs weaknesses — all on one page.",
    color: "text-violet-400",
    bg: "bg-violet-400/5 border-violet-400/20",
    comingSoon: true,
  },
  {
    icon: ShieldCheck,
    title: "Evals Dashboard",
    description:
      "Browse all your saved analyses in one place. Search, filter by recommendation or score range, sort by date — never lose a candidate evaluation.",
    color: "text-sky-400",
    bg: "bg-sky-400/5 border-sky-400/20",
    comingSoon: true,
  },
];

export function FeaturesOverview() {
  return (
    <section id="features" className="py-20">
      <AnimateOnView>
        <SectionHeader
          title="Everything You Need"
          subtitle="AI-powered developer intelligence. One platform. Zero guesswork."
        />
      </AnimateOnView>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, i) => (
          <AnimateOnView key={feature.title} delay={0.05 * i}>
            <TerminalWindow
              title={feature.title.toLowerCase().replace(/ /g, "-")}
              className={`h-full border ${feature.bg.split(" ")[1] || ""}`}
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-md ${feature.bg.split(" ")[0]}`}
                  >
                    <feature.icon className={`h-5 w-5 ${feature.color}`} />
                  </div>
                  {feature.comingSoon && (
                    <Badge variant="outline" className="font-mono text-[9px] text-muted-foreground">
                      Coming Soon
                    </Badge>
                  )}
                </div>
                <h3 className="font-mono text-sm font-bold">{feature.title}</h3>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </TerminalWindow>
          </AnimateOnView>
        ))}
      </div>
    </section>
  );
}
