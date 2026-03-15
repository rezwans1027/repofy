"use client";

import { motion } from "framer-motion";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import { Badge } from "@/components/ui/badge";
import { Star, GitFork } from "lucide-react";
import type { RepoData } from "../profile-sections";

interface TopRepositoriesProps {
  repos: RepoData[];
}

export function TopRepositories({ repos }: TopRepositoriesProps) {
  return (
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
              {repo.url && /^https?:\/\//i.test(repo.url) ? (
                <a
                  href={repo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm font-bold text-cyan hover:underline underline-offset-2"
                >
                  {repo.name}
                </a>
              ) : (
                <h3 className="font-mono text-sm font-bold text-cyan">
                  {repo.name}
                </h3>
              )}
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
  );
}
