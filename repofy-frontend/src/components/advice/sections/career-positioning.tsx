"use client";

import { motion } from "framer-motion";
import { Briefcase, Star } from "lucide-react";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import { Badge } from "@/components/ui/badge";
import {
  staggerContainer,
  staggerItem,
  badgePop,
  EASE_OUT_EXPO,
} from "@/lib/animation-variants";
import type { AdviceData } from "@/components/advice/advice-report";

interface CareerPositioningProps {
  data: AdviceData["careerPositioning"];
}

export function CareerPositioning({ data }: CareerPositioningProps) {
  const empty = !data.positioning && data.roles.length === 0;

  if (empty) {
    return (
      <AnimateOnView delay={0.16}>
        <div className="rounded-lg border border-border bg-card p-5">
          <SectionHeader title="Career Positioning" />
          <p className="text-xs text-muted-foreground">No career positioning available.</p>
        </div>
      </AnimateOnView>
    );
  }

  return (
    <AnimateOnView delay={0.16}>
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHeader
          title="Career Positioning"
          subtitle="How to frame yourself for job applications"
        />
        <div className="space-y-4">
          {/* Positioning narrative with animated border */}
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
              {data.positioning}
            </motion.p>
          </div>

          {/* Fitting roles — badges pop in with stagger */}
          {data.roles.length > 0 && (
            <div className="space-y-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-400">
                Fitting Roles
              </span>
              <motion.div
                className="flex flex-wrap gap-2"
                variants={staggerContainer}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
              >
                {data.roles.map((role) => (
                  <motion.div key={role} variants={badgePop}>
                    <Badge
                      className="border bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[11px]"
                    >
                      <Briefcase className="size-3 mr-1.5" />
                      {role}
                    </Badge>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          )}

          {/* Differentiators — staggered slide-in */}
          {data.differentiators.length > 0 && (
            <div className="space-y-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-400">
                What Sets You Apart
              </span>
              <motion.div
                className="space-y-2"
                variants={staggerContainer}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
              >
                {data.differentiators.map((d) => (
                  <motion.div
                    key={d}
                    variants={staggerItem}
                    whileHover={{
                      x: 4,
                      transition: { type: "spring", stiffness: 400, damping: 30 },
                    }}
                    className="flex gap-3 rounded-md border border-border bg-background p-3 transition-colors hover:border-amber-500/30 cursor-default"
                  >
                    <Star className="size-4 shrink-0 text-amber-400 mt-0.5" />
                    <p className="text-xs leading-relaxed">{d}</p>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          )}
        </div>
      </div>
    </AnimateOnView>
  );
}
