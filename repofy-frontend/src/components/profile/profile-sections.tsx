"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import { HeatmapGrid } from "@/components/ui/heatmap-grid";
import { CountUp } from "@/components/ui/count-up";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FakeUser, FakeRepo } from "@/lib/demo-data";
import { generateHeatmapData } from "@/lib/demo-data";
import {
  Star,
  GitFork,
  BookOpen,
  Users,
  Flame,
  Sparkles,
} from "lucide-react";

interface ProfileSectionsProps {
  user: FakeUser;
  repos: FakeRepo[];
}

export function ProfileSections({ user, repos }: ProfileSectionsProps) {
  const heatmapData = useMemo(() => generateHeatmapData(), []);

  const stats = [
    { label: "Repositories", value: user.repos, icon: BookOpen },
    { label: "Stars Earned", value: user.stars, icon: Star },
    { label: "Followers", value: user.followers, icon: Users },
    { label: "Contributions", value: user.contributions, icon: Flame },
  ];

  return (
    <div className="space-y-12">
      {/* Stats Grid */}
      <AnimateOnView delay={0.1}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <stat.icon className="size-4" />
                <span className="font-mono text-xs">{stat.label}</span>
              </div>
              <CountUp
                end={stat.value}
                className="text-2xl font-bold text-foreground"
              />
            </div>
          ))}
        </div>
      </AnimateOnView>

      {/* Top Languages */}
      <AnimateOnView delay={0.15}>
        <SectionHeader title="Top Languages" />
        <div className="space-y-3">
          <div className="h-4 overflow-hidden rounded-full">
            <motion.div
              className="flex h-full origin-left"
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              {user.languages.map((lang) => (
                <div
                  key={lang.name}
                  className="h-full"
                  style={{
                    backgroundColor: lang.color,
                    width: `${lang.percentage}%`,
                  }}
                />
              ))}
            </motion.div>
          </div>
          <div className="flex flex-wrap gap-3">
            {user.languages.map((lang) => (
              <div key={lang.name} className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: lang.color }}
                />
                <span className="font-mono text-xs text-muted-foreground">
                  {lang.name}{" "}
                  <span className="text-foreground">{lang.percentage}%</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </AnimateOnView>

      {/* Top Repositories */}
      <AnimateOnView delay={0.2}>
        <SectionHeader
          title="Top Repositories"
          subtitle="Most starred repositories"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {repos.map((repo, i) => (
            <motion.div
              key={repo.name}
              className="rounded-lg border border-border bg-card p-4 space-y-3"
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <div className="flex items-start justify-between">
                <h3 className="font-mono text-sm font-bold text-cyan">
                  {repo.name}
                </h3>
                <Badge
                  variant="secondary"
                  className="font-mono text-[10px] shrink-0"
                >
                  {repo.updatedAt}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {repo.description}
              </p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: repo.languageColor }}
                  />
                  {repo.language}
                </span>
                <span className="flex items-center gap-1">
                  <Star className="size-3" />
                  {repo.stars}
                </span>
                <span className="flex items-center gap-1">
                  <GitFork className="size-3" />
                  {repo.forks}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </AnimateOnView>

      {/* Contribution Heatmap */}
      <AnimateOnView delay={0.25}>
        <SectionHeader
          title="Contribution Activity"
          subtitle="Last 52 weeks of contributions"
        />
        <div className="rounded-lg border border-border bg-card p-4">
          <HeatmapGrid data={heatmapData} />
          <div className="mt-3 flex items-center justify-end gap-1.5 text-xs text-muted-foreground font-mono">
            <span>Less</span>
            {[0, 1, 2, 3, 4].map((level) => (
              <div
                key={level}
                className="h-2.5 w-2.5 rounded-[2px]"
                style={{
                  backgroundColor:
                    [
                      "var(--secondary)",
                      "#064E3B",
                      "#065F46",
                      "#047857",
                      "#22D3EE",
                    ][level],
                }}
              />
            ))}
            <span>More</span>
          </div>
        </div>
      </AnimateOnView>

    </div>
  );
}
