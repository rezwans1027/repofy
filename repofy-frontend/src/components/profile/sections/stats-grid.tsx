"use client";

import { AnimateOnView } from "@/components/ui/animate-on-view";
import { CountUp } from "@/components/ui/count-up";
import { BookOpen, Star, Users, Flame } from "lucide-react";

interface StatsGridProps {
  repos: number;
  stars: number;
  followers: number;
  contributions: number;
  contributionsIsEstimate?: boolean;
}

export function StatsGrid({ repos, stars, followers, contributions, contributionsIsEstimate }: StatsGridProps) {
  const stats = [
    { label: "Repositories", value: repos, icon: BookOpen },
    { label: "Stars Earned", value: stars, icon: Star },
    { label: "Followers", value: followers, icon: Users },
    { label: contributionsIsEstimate ? "Recent Events" : "Contributions", value: contributions, icon: Flame },
  ];

  return (
    <AnimateOnView delay={0.1}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-border bg-card p-3"
          >
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <stat.icon className="size-4" />
              <span className="font-mono text-xs">{stat.label}</span>
            </div>
            <CountUp
              end={stat.value}
              className="text-xl font-bold text-foreground"
            />
          </div>
        ))}
      </div>
    </AnimateOnView>
  );
}
