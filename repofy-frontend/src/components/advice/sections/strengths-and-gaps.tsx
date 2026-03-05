"use client";

import { motion } from "framer-motion";
import { Check, AlertTriangle } from "lucide-react";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import {
  staggerContainer,
  staggerItemLeft,
  staggerItemRight,
} from "@/lib/animation-variants";
import type { AdviceData } from "@/components/advice/advice-report";

interface StrengthsAndGapsProps {
  data: AdviceData["strengthsAndGaps"];
}

export function StrengthsAndGaps({ data }: StrengthsAndGapsProps) {
  const empty = data.strengths.length === 0 && data.gaps.length === 0;

  if (empty) {
    return (
      <AnimateOnView delay={0.12}>
        <div className="rounded-lg border border-border bg-card p-5">
          <SectionHeader title="Strengths & Gaps" />
          <p className="text-xs text-muted-foreground">No strengths and gaps analysis available.</p>
        </div>
      </AnimateOnView>
    );
  }

  return (
    <AnimateOnView delay={0.12}>
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHeader
          title="Strengths & Gaps"
          subtitle="What your profile demonstrates vs what's missing"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Strengths — cascade from left */}
          <motion.div
            className="space-y-2"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-400">
              Strengths
            </span>
            {data.strengths.map((s) => (
              <motion.div
                key={s.area}
                variants={staggerItemLeft}
                whileHover={{
                  x: 4,
                  transition: { type: "spring", stiffness: 400, damping: 30 },
                }}
                className="flex gap-3 rounded-md border border-border bg-background p-3 transition-colors hover:border-emerald-500/30 cursor-default"
              >
                <Check className="size-4 shrink-0 text-emerald-400 mt-0.5" />
                <div>
                  <p className="text-xs font-medium">{s.area}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{s.detail}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Gaps — cascade from right */}
          <motion.div
            className="space-y-2"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <span className="font-mono text-[10px] uppercase tracking-wider text-orange-400">
              Gaps
            </span>
            {data.gaps.map((g) => (
              <motion.div
                key={g.area}
                variants={staggerItemRight}
                whileHover={{
                  x: -4,
                  transition: { type: "spring", stiffness: 400, damping: 30 },
                }}
                className="flex gap-3 rounded-md border border-border bg-background p-3 transition-colors hover:border-orange-500/30 cursor-default"
              >
                <AlertTriangle className="size-4 shrink-0 text-orange-400 mt-0.5" />
                <div>
                  <p className="text-xs font-medium">{g.area}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{g.detail}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </AnimateOnView>
  );
}
