"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Wrench, Star } from "lucide-react";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import { Badge } from "@/components/ui/badge";
import { PRIORITY_STYLES } from "@/lib/styles";
import type { AdviceData } from "@/components/advice/advice-report";

interface RepoImprovementsProps {
  repoImprovements: AdviceData["repoImprovements"];
  expandAll?: boolean;
}

export function RepoImprovements({ repoImprovements, expandAll = false }: RepoImprovementsProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <AnimateOnView delay={0.18}>
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHeader
          title="Repository Improvements"
          subtitle="Specific upgrades for your existing repos"
        />
        <div className="space-y-3">
          {repoImprovements.map((repo) => (
            <div
              key={repo.repoName}
              className="rounded-md border border-border bg-background overflow-hidden"
            >
              <button
                onClick={() =>
                  setExpanded(expanded === repo.repoName ? null : repo.repoName)
                }
                className="flex w-full items-center justify-between p-3 text-left hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Wrench className="size-3.5 shrink-0 text-emerald-400" />
                  <span className="font-mono text-sm font-bold truncate">
                    {repo.repoName}
                  </span>
                  <Badge variant="secondary" className="text-[9px] shrink-0">
                    {repo.improvements.length} improvements
                  </Badge>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {repo.stars !== undefined && (
                    <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                      <Star className="size-3" />
                      {repo.stars}
                    </span>
                  )}
                  <ChevronDown
                    className={`size-4 text-muted-foreground transition-transform ${
                      expanded === repo.repoName ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </button>

              {(expandAll || expanded === repo.repoName) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  transition={{ duration: 0.25 }}
                  className="border-t border-border"
                >
                  <div className="p-4 space-y-3">
                    {repo.improvements.map((imp) => (
                      <div key={`${imp.area}-${imp.priority}`} className="flex gap-3">
                        <div className="mt-0.5 shrink-0">
                          <Badge className={`border text-[9px] w-14 justify-center ${PRIORITY_STYLES[imp.priority] ?? ""}`}>
                            {imp.priority}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-xs font-medium">
                            <span className="text-muted-foreground">{imp.area}:</span>{" "}
                            {imp.suggestion}
                          </p>
                        </div>
                      </div>
                    ))}
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
