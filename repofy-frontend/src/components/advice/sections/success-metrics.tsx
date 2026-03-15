"use client";

import { motion } from "framer-motion";
import { Target } from "lucide-react";
import { SectionCard } from "@/components/ui/section-card";
import { ADVISOR_ACCENT } from "@/lib/styles";
import { staggerContainer, staggerItem } from "@/lib/animation-variants";

interface SuccessMetricsProps {
  metrics: string[];
}

export function SuccessMetrics({ metrics }: SuccessMetricsProps) {
  if (metrics.length === 0) {
    return (
      <SectionCard delay={0.12} title="Success Metrics">
          <p className="text-xs text-muted-foreground">No success metrics available.</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard delay={0.12} title="Success Metrics" subtitle="Measurable checkpoints for your 12-week plan">

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
              className={`flex gap-3 rounded-md border border-border bg-background p-3 hover:border-emerald-500/30 cursor-default`}
            >
              <Target className={`size-4 shrink-0 ${ADVISOR_ACCENT} mt-0.5`} />
              <p className="text-xs leading-relaxed">{metric}</p>
            </motion.div>
          ))}
        </motion.div>
    </SectionCard>
  );
}
