"use client";

import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import { CountUp } from "@/components/ui/count-up";
import { GitPullRequest, GitMerge, Eye } from "lucide-react";

interface PrActivityProps {
  prActivity: {
    opened: number;
    merged: number;
    reviewed: number;
  };
}

export function PrActivity({ prActivity }: PrActivityProps) {
  return (
    <AnimateOnView delay={0.16}>
      <SectionHeader title="Pull Request Activity" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <GitPullRequest className="size-4" />
            <span className="font-mono text-xs">Opened</span>
          </div>
          <CountUp
            end={prActivity.opened}
            className="text-xl font-bold text-foreground"
          />
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <GitMerge className="size-4" />
            <span className="font-mono text-xs">Merged</span>
          </div>
          <CountUp
            end={prActivity.merged}
            className="text-xl font-bold text-foreground"
          />
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Eye className="size-4" />
            <span className="font-mono text-xs">Reviewed</span>
          </div>
          <CountUp
            end={prActivity.reviewed}
            className="text-xl font-bold text-foreground"
          />
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <GitMerge className="size-4" />
            <span className="font-mono text-xs">Merge Rate</span>
          </div>
          <CountUp
            end={prActivity.opened > 0 ? Math.round((prActivity.merged / prActivity.opened) * 100) : 0}
            suffix="%"
            className="text-xl font-bold text-foreground"
          />
        </div>
      </div>
    </AnimateOnView>
  );
}
