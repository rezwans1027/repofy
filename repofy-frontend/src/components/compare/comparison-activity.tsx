"use client";

import { motion } from "framer-motion";
import { SectionHeader } from "@/components/ui/section-header";
import type { ReportData } from "@/components/report/analysis-report";

interface ComparisonActivityProps {
  reportA: ReportData;
  reportB: ReportData;
  usernameA: string;
  usernameB: string;
}

const SEGMENT_COLORS = [
  { label: "Push", key: "push" as const, color: "#22D3EE" },
  { label: "PR", key: "pr" as const, color: "#A78BFA" },
  { label: "Issue", key: "issue" as const, color: "#FBBF24" },
  { label: "Review", key: "review" as const, color: "#34D399" },
];

function ActivityBar({
  data,
  username,
  accentColor,
}: {
  data: ReportData["activityBreakdown"];
  username: string;
  accentColor: string;
}) {
  return (
    <div className="space-y-1.5">
      <p className="font-mono text-xs" style={{ color: accentColor }}>
        @{username}
      </p>
      <div className="flex h-5 w-full overflow-hidden rounded-full">
        {SEGMENT_COLORS.map((seg) => (
          <motion.div
            key={seg.key}
            className="h-full"
            style={{ backgroundColor: seg.color }}
            initial={{ width: 0 }}
            animate={{ width: `${data[seg.key]}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        ))}
      </div>
    </div>
  );
}

export function ComparisonActivity({
  reportA,
  reportB,
  usernameA,
  usernameB,
}: ComparisonActivityProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <SectionHeader title="Activity Breakdown" />
      <div className="space-y-4">
        <ActivityBar
          data={reportA.activityBreakdown}
          username={usernameA}
          accentColor="#22D3EE"
        />
        <ActivityBar
          data={reportB.activityBreakdown}
          username={usernameB}
          accentColor="#A78BFA"
        />
      </div>

      {/* Shared legend */}
      <div className="mt-4 flex flex-wrap gap-4">
        {SEGMENT_COLORS.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5">
            <div
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: seg.color }}
            />
            <span className="font-mono text-xs text-muted-foreground">{seg.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
