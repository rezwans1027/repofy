"use client";

import { motion } from "framer-motion";
import { Target } from "lucide-react";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import { staggerContainer, staggerItem } from "@/lib/animation-variants";

interface SuccessMetricsProps {
  metrics: string[];
}

export function SuccessMetrics({ metrics }: SuccessMetricsProps) {
  if (metrics.length === 0) {
    return (
      <AnimateOnView delay={0.12}>
        <div className="rounded-lg border border-border bg-card p-5">
          <SectionHeader title="Success Metrics" />
          <p className="text-xs text-muted-foreground">No success metrics available.</p>
        </div>
      </AnimateOnView>
    );
  }

  return (
    <AnimateOnView delay={0.12}>
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHeader
          title="Success Metrics"
          subtitle="Measurable checkpoints for your 12-week plan"
        />

        <motion.div
          className="space-y-2"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {metrics.map((metric, i) => (
            <motion.div
              key={i}
              variants={staggerItem}
              whileHover={{
                x: 4,
                transition: { type: "spring", stiffness: 400, damping: 30 },
              }}
              className="flex gap-3 rounded-md border border-border bg-background p-3 transition-colors hover:border-emerald-500/30 cursor-default"
            >
              <Target className="size-4 shrink-0 text-emerald-400 mt-0.5" />
              <p className="text-xs leading-relaxed">{metric}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </AnimateOnView>
  );
}
