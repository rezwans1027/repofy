"use client";

import { motion } from "framer-motion";
import { Compass } from "lucide-react";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import { Badge } from "@/components/ui/badge";
import {
  staggerContainer,
  staggerItem,
  EASE_OUT_EXPO,
} from "@/lib/animation-variants";
import type { AdviceData } from "@/types/advice";

const CONFIDENCE_STYLES: Record<string, string> = {
  High: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  Medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  Low: "bg-red-500/15 text-red-400 border-red-500/30",
};

const LEVEL_STYLES: Record<string, string> = {
  Junior: "text-blue-400",
  "Mid-Level": "text-cyan",
  Senior: "text-emerald-400",
  Staff: "text-amber-400",
};

interface TrajectoryProps {
  trajectory: AdviceData["trajectory"];
}

export function TrajectorySection({ trajectory }: TrajectoryProps) {
  const calibrationEntries = [
    { label: "Complexity", value: trajectory.calibration.complexity },
    { label: "Breadth", value: trajectory.calibration.breadth },
    { label: "Collaboration", value: trajectory.calibration.collaboration },
    { label: "Engineering Practices", value: trajectory.calibration.engineeringPractices },
    { label: "Consistency", value: trajectory.calibration.consistency },
  ];

  return (
    <AnimateOnView delay={0.08}>
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHeader
          title="Career Trajectory"
          subtitle="Estimated level and growth path"
        />
        <div className="space-y-4">
          {/* Level badges with animated arrow */}
          <motion.div
            className="flex items-center gap-3 flex-wrap"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1, ease: EASE_OUT_EXPO }}
          >
            <div className="flex items-center gap-2">
              <motion.div
                initial={{ rotate: -90, opacity: 0 }}
                whileInView={{ rotate: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
              >
                <Compass className="size-4 text-emerald-400" />
              </motion.div>
              <span className="font-mono text-xs text-muted-foreground">Current:</span>
              <span className={`font-mono text-sm font-bold ${LEVEL_STYLES[trajectory.currentEstimate] ?? "text-foreground"}`}>
                {trajectory.currentEstimate}
              </span>
            </div>

            {/* Animated arrow */}
            <motion.span
              className="text-emerald-400 font-bold"
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.35, ease: EASE_OUT_EXPO }}
            >
              →
            </motion.span>

            <motion.div
              className="flex items-center gap-2"
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.45, ease: EASE_OUT_EXPO }}
            >
              <span className="font-mono text-xs text-muted-foreground">Target:</span>
              <span className={`font-mono text-sm font-bold ${LEVEL_STYLES[trajectory.targetEstimate] ?? "text-foreground"}`}>
                {trajectory.targetEstimate}
              </span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, ease: EASE_OUT_EXPO, delay: 0.55 }}
            >
              <Badge className={`border text-[9px] ${CONFIDENCE_STYLES[trajectory.confidence] ?? ""}`}>
                {trajectory.confidence} confidence
              </Badge>
            </motion.div>
          </motion.div>

          {/* Rationale with animated border */}
          <div className="relative pl-3">
            <motion.div
              className="absolute left-0 top-0 w-0.5 rounded-full bg-emerald-400/30"
              initial={{ height: 0 }}
              whileInView={{ height: "100%" }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.15, ease: EASE_OUT_EXPO }}
            />
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="text-xs text-muted-foreground leading-relaxed"
            >
              {trajectory.rationale}
            </motion.p>
          </div>

          {/* Staggered calibration grid */}
          <motion.div
            className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {calibrationEntries.map((entry) => (
              <motion.div
                key={entry.label}
                variants={staggerItem}
                whileHover={{
                  scale: 1.02,
                  transition: { type: "spring", stiffness: 400, damping: 30 },
                }}
                className="rounded-md border border-border bg-background p-3 transition-colors hover:border-emerald-500/30"
              >
                <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-400">
                  {entry.label}
                </span>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {entry.value}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </AnimateOnView>
  );
}
