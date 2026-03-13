"use client";

import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import { AdviceEmptyState } from "./advice-empty-state";
import {
  staggerContainer,
  staggerItem,
  contentFade,
  borderGrow,
} from "@/lib/animation-variants";
import type { AdviceData } from "@shared/types/advice";

interface ContributionStrategyProps {
  items: AdviceData["contributionStrategy"];
}

export function ContributionStrategy({ items }: ContributionStrategyProps) {
  if (items.length === 0) {
    return (
      <AdviceEmptyState
        title="Contribution Strategy"
        message="No contribution strategy available."
        delay={0.12}
      />
    );
  }

  return (
    <AnimateOnView delay={0.12}>
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHeader title="Contribution Strategy" />

        <motion.div
          className="space-y-3"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {items.map((item) => (
            <motion.div
              key={item.title}
              variants={staggerItem}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              whileHover={{ x: 4 }}
              className="rounded-md border border-border bg-background p-3 space-y-2 hover:border-emerald-500/30 cursor-default"
            >
              <div className="flex gap-3">
                <TrendingUp className="size-4 shrink-0 text-emerald-400 mt-0.5" />
                <p className="text-sm font-medium">{item.title}</p>
              </div>
              <motion.div className="space-y-2 pl-7" variants={contentFade}>
                <p className="text-[11px] text-muted-foreground">
                  {item.detail}
                </p>
                <div className="relative pl-2">
                  <motion.div
                    className="absolute left-0 top-0 w-px rounded-full bg-emerald-400/20"
                    variants={borderGrow}
                  />
                  <p className="text-[11px] text-muted-foreground italic">
                    {item.evidence}
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
