"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import type { ReportData } from "@/components/report/analysis-report";

interface ActivityBreakdownProps {
  activityBreakdown: ReportData["activityBreakdown"];
}

export function ActivityBreakdown({ activityBreakdown }: ActivityBreakdownProps) {
  const segments = useMemo(
    () => [
      { label: "Push", pct: activityBreakdown.push, color: "#22D3EE" },
      { label: "PR", pct: activityBreakdown.pr, color: "#A78BFA" },
      { label: "Issue", pct: activityBreakdown.issue, color: "#FBBF24" },
      { label: "Review", pct: activityBreakdown.review, color: "#34D399" },
    ],
    [activityBreakdown.push, activityBreakdown.pr, activityBreakdown.issue, activityBreakdown.review],
  );

  return (
    <AnimateOnView delay={0.24}>
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHeader title="Activity Breakdown" />
        <div className="flex h-6 w-full overflow-hidden rounded-full">
          {segments.map((seg) => (
            <motion.div
              key={seg.label}
              className="h-full"
              style={{ backgroundColor: seg.color }}
              initial={{ width: 0 }}
              whileInView={{ width: `${seg.pct}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-4">
          {segments.map((seg) => (
            <div key={seg.label} className="flex items-center gap-1.5">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: seg.color }}
              />
              <span className="font-mono text-xs text-muted-foreground">
                {seg.label} {seg.pct}%
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {activityBreakdown.interpretation}
        </p>
      </div>
    </AnimateOnView>
  );
}
