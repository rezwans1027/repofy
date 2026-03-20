"use client";

import { motion } from "framer-motion";
import { SectionCard } from "@/components/ui/section-card";
import { AdviceEmptyState } from "./advice-empty-state";
import { Badge } from "@/components/ui/badge";
import { DEMAND_STYLES, TIMELINE_STYLES, ADVISOR_ACCENT, ADVISOR_HOVER_BORDER, ADVISOR_SIDEBAR } from "@/lib/styles";
import {
  staggerContainer,
  staggerItemScale,
  staggerContainerFast,
  badgePop,
  contentFade,
  borderGrow,
} from "@/lib/animation-variants";
import type { AdviceData } from "@shared/types/advice";

interface SkillRoadmapProps {
  skills: AdviceData["skillRoadmap"];
}

export function SkillRoadmap({ skills }: SkillRoadmapProps) {
  if (skills.length === 0) {
    return (
      <AdviceEmptyState
        title="Skill Roadmap"
        message="No skill suggestions available — your stack already covers the key areas."
        delay={0.08}
      />
    );
  }

  return (
    <SectionCard delay={0.08} title="Skill Roadmap" subtitle="Based on your stack and market demand">

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
              className={`rounded-md border border-border bg-background p-4 space-y-2 ${ADVISOR_HOVER_BORDER} cursor-default`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-mono text-sm font-bold min-w-0">{skill.skill}</h3>
                <motion.div
                  className="flex items-center gap-1.5"
                  variants={staggerContainerFast}
                >
                  <motion.div variants={badgePop}>
                    <Badge className={`border text-[9px] ${TIMELINE_STYLES[skill.priority] ?? ""}`}>
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
                  <span className={ADVISOR_ACCENT}>Related to:</span> {skill.relatedTo}
                </p>
                <div className="relative pl-2">
                  <motion.div
                    className={`absolute left-0 top-0 w-px rounded-full ${ADVISOR_SIDEBAR}`}
                    variants={borderGrow}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    <span className={ADVISOR_ACCENT}>Proof:</span> {skill.proofOfLearning}
                  </p>
                </div>
              </motion.div>
            </motion.div>
          ))}
        </motion.div>
    </SectionCard>
  );
}
