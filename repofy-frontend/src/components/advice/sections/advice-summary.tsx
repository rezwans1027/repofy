"use client";

import { motion } from "framer-motion";
import { SectionCard } from "@/components/ui/section-card";
import { EASE_OUT_EXPO } from "@/lib/animation-variants";

interface AdviceSummaryProps {
  summary: string;
}

export function AdviceSummary({ summary }: AdviceSummaryProps) {
  return (
    <SectionCard delay={0.06} title="Summary">
        <div className="relative pl-4">
          {/* Animated left border that grows from top to bottom */}
          <motion.div
            className="absolute left-0 top-0 w-0.5 rounded-full bg-emerald-400/40"
            initial={{ height: 0, opacity: 0 }}
            whileInView={{ height: "100%", opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2, ease: EASE_OUT_EXPO }}
          />
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.35 }}
            className="text-sm leading-relaxed text-muted-foreground"
          >
            {summary}
          </motion.p>
        </div>
    </SectionCard>
  );
}
