"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { motion } from "framer-motion";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import { HeatmapGrid } from "@/components/ui/heatmap-grid";
import { CountUp } from "@/components/ui/count-up";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fakeUsers, fakeRepos, generateHeatmapData } from "@/lib/demo-data";
import {
  ArrowLeft,
  MapPin,
  Building2,
  Calendar,
  Star,
  GitFork,
  BookOpen,
  Users,
  Flame,
  Sparkles,
} from "lucide-react";

export default function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = use(params);
  const user = fakeUsers.find((u) => u.username === username);
  const repos = fakeRepos[username];

  const heatmapData = useMemo(() => generateHeatmapData(), []);

  if (!user || !repos) {
    notFound();
  }

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("");

  const stats = [
    { label: "Repositories", value: user.repos, icon: BookOpen },
    { label: "Stars Earned", value: user.stars, icon: Star },
    { label: "Followers", value: user.followers, icon: Users },
    { label: "Contributions", value: user.contributions, icon: Flame },
  ];

  return (
    <div className="space-y-12">
      {/* Back link */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-cyan transition-colors"
      >
        <ArrowLeft className="size-3" />
        back to search
      </Link>

      {/* Profile Header */}
      <AnimateOnView>
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-2xl font-bold text-cyan border-2 border-cyan/20">
            {initials}
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline gap-3">
              <h1 className="font-mono text-2xl font-bold tracking-tight">
                {user.name}
              </h1>
              <span className="font-mono text-sm text-muted-foreground">
                @{user.username}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{user.bio}</p>
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="size-3" />
                {user.location}
              </span>
              <span className="flex items-center gap-1">
                <Building2 className="size-3" />
                {user.company}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="size-3" />
                Joined {user.joinedYear}
              </span>
            </div>
          </div>
        </div>
      </AnimateOnView>

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
          {/* Language bar */}
          <div className="flex h-4 overflow-hidden rounded-full">
            {user.languages.map((lang) => (
              <motion.div
                key={lang.name}
                className="h-full"
                style={{ backgroundColor: lang.color }}
                initial={{ width: 0 }}
                whileInView={{ width: `${lang.percentage}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            ))}
          </div>
          {/* Language legend */}
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

      {/* Start Analysis CTA */}
      <AnimateOnView delay={0.3}>
        <div className="flex flex-col items-center gap-4 rounded-lg border border-cyan/20 bg-cyan/5 p-8">
          <Sparkles className="size-8 text-cyan" />
          <div className="text-center">
            <h3 className="font-mono text-lg font-bold">
              Ready to analyze{" "}
              <span className="text-cyan">@{user.username}</span>?
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Generate a hiring-grade developer evaluation from their code.
            </p>
          </div>
          <Button
            size="lg"
            className="bg-cyan text-background hover:bg-cyan/90 font-mono text-sm px-8"
            onClick={() => {}}
          >
            <Sparkles className="size-4" />
            Start Analysis
          </Button>
        </div>
      </AnimateOnView>
    </div>
  );
}
