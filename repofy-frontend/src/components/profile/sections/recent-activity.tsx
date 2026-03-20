"use client";

import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import { CountUp } from "@/components/ui/count-up";
import { Activity, GitPullRequest, CircleDot, Eye } from "lucide-react";

interface RecentActivityProps {
  activityBreakdown: {
    pushEvents: number;
    prEvents: number;
    issueEvents: number;
    reviewEvents: number;
  };
}

export function RecentActivity({ activityBreakdown }: RecentActivityProps) {
  return (
    <AnimateOnView delay={0.16}>
      <SectionHeader title="Recent Activity" subtitle="Last 100 public events" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Activity className="size-4" />
            <span className="font-mono text-xs">Pushes</span>
          </div>
          <CountUp
            end={activityBreakdown.pushEvents}
            className="text-xl font-bold text-foreground"
          />
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <GitPullRequest className="size-4" />
            <span className="font-mono text-xs">PRs Opened</span>
          </div>
          <CountUp
            end={activityBreakdown.prEvents}
            className="text-xl font-bold text-foreground"
          />
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <CircleDot className="size-4" />
            <span className="font-mono text-xs">Issues</span>
          </div>
          <CountUp
            end={activityBreakdown.issueEvents}
            className="text-xl font-bold text-foreground"
          />
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Eye className="size-4" />
            <span className="font-mono text-xs">Reviews</span>
          </div>
          <CountUp
            end={activityBreakdown.reviewEvents}
            className="text-xl font-bold text-foreground"
          />
        </div>
      </div>
    </AnimateOnView>
  );
}
