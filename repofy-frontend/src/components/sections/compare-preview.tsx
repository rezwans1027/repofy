"use client";

import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { GitCompareArrows, Radar, BarChart3, Languages, FileDown } from "lucide-react";

const plannedFeatures = [
  {
    icon: Radar,
    label: "Overlaid radar charts",
    description: "Compare Developer DNA across all 6 axes on a single chart",
  },
  {
    icon: BarChart3,
    label: "Stats breakdown",
    description: "Side-by-side repos, stars, followers, contributions, and activity",
  },
  {
    icon: Languages,
    label: "Language profiles",
    description: "Compare language breadth, depth, and tech stack overlap",
  },
  {
    icon: FileDown,
    label: "Exportable PDF",
    description: "Share comparison reports with your hiring team",
  },
];

export function ComparePreview() {
  return (
    <section id="compare" className="py-20">
      <AnimateOnView>
        <SectionHeader
          title="Candidate Comparison"
          subtitle="Compare two developers side-by-side. Every dimension. One page."
        />
      </AnimateOnView>

      <AnimateOnView delay={0.1}>
        <div className="rounded-lg border border-violet-400/20 bg-violet-400/5 p-8 sm:p-10">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-violet-400/30 bg-violet-400/10">
              <GitCompareArrows className="h-6 w-6 text-violet-400" />
            </div>
            <Badge variant="outline" className="mt-4 font-mono text-xs text-violet-400 border-violet-400/30">
              Coming Soon
            </Badge>
            <h3 className="mt-4 font-mono text-lg font-bold">
              Side-by-Side Candidate Comparison
            </h3>
            <p className="text-muted-foreground mt-2 max-w-lg text-sm">
              Put two candidates head-to-head with overlaid radar charts, detailed stats breakdowns,
              and strengths vs weaknesses — all on one page. Make confident hiring decisions backed by data.
            </p>
          </div>

          <motion.div
            className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-40px" }}
            variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
          >
            {plannedFeatures.map((feature) => (
              <motion.div
                key={feature.label}
                className="rounded-md border border-border bg-background/50 p-4"
                variants={{
                  hidden: { opacity: 0, y: 16, filter: "blur(4px)" },
                  visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.4 } },
                }}
              >
                <feature.icon className="h-4 w-4 text-violet-400" />
                <p className="mt-2 font-mono text-xs font-bold">{feature.label}</p>
                <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </AnimateOnView>
    </section>
  );
}
