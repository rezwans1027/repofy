"use client";

import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import { CountUp } from "@/components/ui/count-up";
import { Zap, Trophy } from "lucide-react";

interface CommitStreakProps {
  commitStreak: {
    current: number;
    longest: number;
  };
}

export function CommitStreak({ commitStreak }: CommitStreakProps) {
  return (
    <AnimateOnView delay={0.2}>
      <SectionHeader title="Commit Streak" />
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Zap className="size-4" />
            <span className="font-mono text-xs">Current Streak</span>
          </div>
          <div className="flex items-baseline gap-1">
            <CountUp
              end={commitStreak.current}
              className="text-xl font-bold text-foreground"
            />
            <span className="font-mono text-xs text-muted-foreground">days</span>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Trophy className="size-4" />
            <span className="font-mono text-xs">Longest Streak</span>
          </div>
          <div className="flex items-baseline gap-1">
            <CountUp
              end={commitStreak.longest}
              className="text-xl font-bold text-foreground"
            />
            <span className="font-mono text-xs text-muted-foreground">days</span>
          </div>
        </div>
      </div>
    </AnimateOnView>
  );
}
