"use client";

import { motion } from "framer-motion";
import { Rocket } from "lucide-react";
import { SectionCard } from "@/components/ui/section-card";
import { Badge } from "@/components/ui/badge";
import { DIFFICULTY_STYLES, ADVISOR_ACCENT, ADVISOR_HOVER_BORDER, ADVISOR_SIDEBAR_STRONG } from "@/lib/styles";
import {
  staggerContainer,
  staggerItem,
  staggerContainerFast,
  badgePop,
  contentFade,
  borderGrow,
} from "@/lib/animation-variants";
import type { AdviceData } from "@shared/types/advice";

interface BuildRoadmapProps {
  builds: AdviceData["buildRoadmap"];
}

export function BuildRoadmap({ builds }: BuildRoadmapProps) {
  return (
    <SectionCard delay={0.06} title="Build Roadmap" subtitle="3 portfolio projects to fill your gaps">

        <motion.div
          className="space-y-4"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {builds.map((build, i) => (
            <motion.div
              key={build.title}
              variants={staggerItem}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              whileHover={{ scale: 1.01, y: -2 }}
              className={`rounded-md border border-border bg-background p-4 space-y-3 ${ADVISOR_HOVER_BORDER} cursor-default`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Rocket className={`size-4 shrink-0 ${ADVISOR_ACCENT}`} />
                  <h3 className="font-mono text-sm font-bold">
                    <span className={`${ADVISOR_ACCENT} mr-1.5`}>#{i + 1}</span>
                    {build.title}
                  </h3>
                </div>
                <motion.div
                  className="flex items-center gap-2 shrink-0"
                  variants={staggerContainerFast}
                >
                  <motion.div variants={badgePop}>
                    <Badge className={`border text-[9px] ${DIFFICULTY_STYLES[build.difficulty] ?? ""}`}>
                      {build.difficulty}
                    </Badge>
                  </motion.div>
                  <motion.div variants={badgePop}>
                    <Badge variant="secondary" className="text-[9px]">
                      {build.estimatedWeeks}w
                    </Badge>
                  </motion.div>
                </motion.div>
              </div>

              <motion.div className="space-y-3" variants={contentFade}>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {build.projectOutcome}
                </p>

                <motion.div
                  className="flex flex-wrap gap-1.5"
                  variants={staggerContainerFast}
                >
                  {build.techStack.map((tech) => (
                    <motion.div key={tech} variants={badgePop}>
                      <Badge variant="secondary" className="text-[10px]">
                        {tech}
                      </Badge>
                    </motion.div>
                  ))}
                </motion.div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      Milestones
                    </span>
                    <ul className="mt-1 space-y-1">
                      {build.milestones.map((m, j) => (
                        <li key={j} className="text-xs text-muted-foreground flex gap-1.5">
                          <span className={`${ADVISOR_ACCENT} shrink-0`}>{j + 1}.</span>
                          {m}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      Hiring Signals
                    </span>
                    <ul className="mt-1 space-y-1">
                      {build.hiringSignals.map((s, j) => (
                        <li key={j} className="text-xs text-muted-foreground flex gap-1.5">
                          <span className={`${ADVISOR_ACCENT} shrink-0`}>&bull;</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="relative pl-3">
                  <motion.div
                    className={`absolute left-0 top-0 w-0.5 rounded-full ${ADVISOR_SIDEBAR_STRONG}`}
                    variants={borderGrow}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    <span className={`${ADVISOR_ACCENT} font-medium`}>Evidence: </span>
                    {build.evidence}
                  </p>
                </div>
              </motion.div>
            </motion.div>
          ))}
        </motion.div>
    </SectionCard>
  );
}
