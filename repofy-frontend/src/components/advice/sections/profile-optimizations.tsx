"use client";

import { motion } from "framer-motion";
import { Target } from "lucide-react";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import {
  staggerContainer,
  staggerItemScale,
  contentFade,
} from "@/lib/animation-variants";
import type { AdviceData } from "@/components/advice/advice-report";

interface ProfileOptimizationsProps {
  optimizations: AdviceData["profileOptimizations"];
}

export function ProfileOptimizations({ optimizations }: ProfileOptimizationsProps) {
  if (optimizations.length === 0) {
    return (
      <AnimateOnView delay={0.16}>
        <div className="rounded-lg border border-border bg-card p-5">
          <SectionHeader title="Profile Optimizations" />
          <p className="text-xs text-muted-foreground">No profile optimization suggestions available.</p>
        </div>
      </AnimateOnView>
    );
  }

  return (
    <AnimateOnView delay={0.16}>
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHeader title="Profile Optimizations" />

        <motion.div
          className="space-y-3"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {optimizations.map((opt) => (
            <motion.div
              key={opt.area}
              variants={staggerItemScale}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              whileHover={{ scale: 1.02, y: -2 }}
              className="rounded-md border border-border bg-background p-3 space-y-2 transition-colors hover:border-emerald-500/20 cursor-default"
            >
              <div className="flex items-center gap-2">
                <Target className="size-3.5 shrink-0 text-emerald-400" />
                <span className="font-mono text-xs font-bold">{opt.area}</span>
              </div>
              <motion.div className="space-y-2" variants={contentFade}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      Current
                    </span>
                    <p className="mt-0.5 text-muted-foreground">{opt.current}</p>
                  </div>
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-400">
                      Suggestion
                    </span>
                    <p className="mt-0.5">{opt.suggestion}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      Example
                    </span>
                    <p className="mt-0.5 text-muted-foreground">{opt.example}</p>
                  </div>
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      Impact
                    </span>
                    <p className="mt-0.5 text-muted-foreground">{opt.impact}</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </AnimateOnView>
  );
}
