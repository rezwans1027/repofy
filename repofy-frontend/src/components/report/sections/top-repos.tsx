"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Award, Star, GitFork } from "lucide-react";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import { Badge } from "@/components/ui/badge";
import { gradeColor } from "@/lib/styles";
import type { ReportData } from "@/components/report/analysis-report";

interface TopReposProps {
  topRepos: ReportData["topRepos"];
  expandAll?: boolean;
}

export function TopRepos({ topRepos, expandAll }: TopReposProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <AnimateOnView delay={0.36}>
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHeader
          title="Top Repositories"
          subtitle="Deep dive into signature projects"
        />
        <div className="space-y-3">
          {topRepos.map((repo) => (
            <div
              key={repo.name}
              className="rounded-md border border-border bg-background overflow-hidden"
            >
              <button
                onClick={() =>
                  !expandAll && setExpanded(expanded === repo.name ? null : repo.name)
                }
                className="flex w-full items-center justify-between p-3 text-left hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-sm font-bold truncate">
                    {repo.name}
                  </span>
                  {repo.isBestWork && (
                    <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[9px] shrink-0">
                      <Award className="size-2.5" />
                      Best Work
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                    <Star className="size-3" />
                    {repo.stars}
                  </span>
                  {!expandAll && (
                    <ChevronDown
                      className={`size-4 text-muted-foreground transition-transform ${
                        expanded === repo.name ? "rotate-180" : ""
                      }`}
                    />
                  )}
                </div>
              </button>

              {(expandAll || expanded === repo.name) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  transition={{ duration: 0.25 }}
                  className="border-t border-border"
                >
                  <div className="p-4 space-y-3">
                    <p className="text-xs text-muted-foreground">
                      {repo.description}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {repo.topics.map((t) => (
                        <Badge
                          key={t}
                          variant="secondary"
                          className="text-[10px]"
                        >
                          {t}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <div
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: repo.languageColor }}
                        />
                        {repo.language}
                      </span>
                      <span className="flex items-center gap-1">
                        <Star className="size-3" /> {repo.stars}
                      </span>
                      <span className="flex items-center gap-1">
                        <GitFork className="size-3" /> {repo.forks}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "Code Quality", grade: repo.codeQuality },
                        { label: "Testing", grade: repo.testing },
                        { label: "CI/CD", grade: repo.cicd },
                      ].map((g) => (
                        <div
                          key={g.label}
                          className="rounded-md border border-border p-2 text-center"
                        >
                          <p className="font-mono text-[10px] text-muted-foreground">
                            {g.label}
                          </p>
                          <p
                            className={`mt-0.5 font-mono text-sm font-bold ${gradeColor(g.grade)}`}
                          >
                            {g.grade}
                          </p>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground border-l-2 border-cyan/30 pl-3">
                      {repo.verdict}
                    </p>
                  </div>
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </div>
    </AnimateOnView>
  );
}
