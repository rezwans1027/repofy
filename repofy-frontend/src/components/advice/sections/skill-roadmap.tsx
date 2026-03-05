"use client";

import { motion } from "framer-motion";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import { Badge } from "@/components/ui/badge";
import { DEMAND_STYLES } from "@/lib/styles";
import {
  staggerContainer,
  staggerItemScale,
  staggerContainerFast,
  badgePop,
  contentFade,
  borderGrow,
} from "@/lib/animation-variants";
import type { AdviceData } from "@/components/advice/advice-report";

const PRIORITY_STYLES: Record<string, string> = {
  Now: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  Next: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  Later: "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

interface SkillRoadmapProps {
  skills: AdviceData["skillRoadmap"];
}

export function SkillRoadmap({ skills }: SkillRoadmapProps) {
  if (skills.length === 0) {
    return (
      <AnimateOnView delay={0.08}>
        <div className="rounded-lg border border-border bg-card p-5">
          <SectionHeader title="Skill Roadmap" />
          <p className="text-xs text-muted-foreground">No skill suggestions available — your stack already covers the key areas.</p>
        </div>
      </AnimateOnView>
    );
  }

  return (
    <AnimateOnView delay={0.08}>
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHeader
          title="Skill Roadmap"
          subtitle="Based on your stack and market demand"
        />

        <motion.div
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {skills.map((skill) => (
            <motion.div
              key={skill.skill}
              variants={staggerItemScale}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              whileHover={{ scale: 1.02, y: -2 }}
              className="rounded-md border border-border bg-background p-4 space-y-2 transition-colors hover:border-emerald-500/20 cursor-default"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-mono text-sm font-bold min-w-0">{skill.skill}</h3>
                <motion.div
                  className="flex items-center gap-1.5"
                  variants={staggerContainerFast}
                >
                  <motion.div variants={badgePop}>
                    <Badge className={`border text-[9px] ${PRIORITY_STYLES[skill.priority] ?? ""}`}>
                      {skill.priority}
                    </Badge>
                  </motion.div>
                  <motion.div variants={badgePop}>
                    <Badge className={`border text-[9px] ${DEMAND_STYLES[skill.demandLevel] ?? ""}`}>
                      {skill.demandLevel}
                    </Badge>
                  </motion.div>
                </motion.div>
              </div>
              <motion.div className="space-y-2" variants={contentFade}>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {skill.reason}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  <span className="text-emerald-400">Related to:</span> {skill.relatedTo}
                </p>
                <div className="relative pl-2">
                  <motion.div
                    className="absolute left-0 top-0 w-px rounded-full bg-emerald-400/20"
                    variants={borderGrow}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    <span className="text-emerald-400">Proof:</span> {skill.proofOfLearning}
                  </p>
                </div>
              </motion.div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </AnimateOnView>
  );
}
