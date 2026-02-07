"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import { HeatmapGrid } from "@/components/ui/heatmap-grid";
import { CountUp } from "@/components/ui/count-up";
import { Badge } from "@/components/ui/badge";
import type { FakeUser, FakeRepo } from "@/lib/demo-data";
import { generateHeatmapData } from "@/lib/demo-data";
import {
  Star,
  GitFork,
  BookOpen,
  Users,
  Flame,
  GitPullRequest,
  GitMerge,
  Eye,
  Zap,
  Trophy,
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
    <div className="space-y-6">
      {/* 1. Stats Grid */}
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

      {/* 2. Top Languages */}
      <AnimateOnView delay={0.12}>
        <SectionHeader title="Top Languages" />
        <div className="space-y-2">
          <div className="h-3 overflow-hidden rounded-full">
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
                  className="h-1.5 w-1.5 rounded-full"
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

      {/* 3. Top Repositories */}
      <AnimateOnView delay={0.14}>
        <SectionHeader
          title="Top Repositories"
          subtitle="Most starred repositories"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {repos.map((repo, i) => (
            <motion.div
              key={repo.name}
              className="rounded-lg border border-border bg-card p-3 space-y-2"
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
              {repo.topics.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {repo.topics.map((topic) => (
                    <span
                      key={topic}
                      className="rounded-full bg-cyan/10 px-2 py-0.5 font-mono text-[10px] text-cyan"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
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

      {/* 4. PR Activity + Merge Rate */}
      <AnimateOnView delay={0.16}>
        <SectionHeader title="Pull Request Activity" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <GitPullRequest className="size-4" />
              <span className="font-mono text-xs">Opened</span>
            </div>
            <CountUp
              end={user.prActivity.opened}
              className="text-xl font-bold text-foreground"
            />
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <GitMerge className="size-4" />
              <span className="font-mono text-xs">Merged</span>
            </div>
            <CountUp
              end={user.prActivity.merged}
              className="text-xl font-bold text-foreground"
            />
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Eye className="size-4" />
              <span className="font-mono text-xs">Reviewed</span>
            </div>
            <CountUp
              end={user.prActivity.reviewed}
              className="text-xl font-bold text-foreground"
            />
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <GitMerge className="size-4" />
              <span className="font-mono text-xs">Merge Rate</span>
            </div>
            <CountUp
              end={Math.round((user.prActivity.merged / user.prActivity.opened) * 100)}
              suffix="%"
              className="text-xl font-bold text-foreground"
            />
          </div>
        </div>
      </AnimateOnView>

      {/* 5. Top Collaborators */}
      <AnimateOnView delay={0.18}>
        <SectionHeader title="Top Collaborators" />
        <div className="flex flex-wrap gap-3">
          {user.topCollaborators.map((collab) => (
            <div
              key={collab.username}
              className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-xs font-bold text-cyan">
                {collab.initials}
              </div>
              <div>
                <p className="font-mono text-xs font-bold text-foreground">
                  @{collab.username}
                </p>
                <p className="font-mono text-[10px] text-muted-foreground">
                  {collab.contributions} contributions
                </p>
              </div>
            </div>
          ))}
        </div>
      </AnimateOnView>

      {/* 6. Commit Streak */}
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
                end={user.commitStreak.current}
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
                end={user.commitStreak.longest}
                className="text-xl font-bold text-foreground"
              />
              <span className="font-mono text-xs text-muted-foreground">days</span>
            </div>
          </div>
        </div>
      </AnimateOnView>

      {/* 7. Contribution Heatmap */}
      <AnimateOnView delay={0.22}>
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
