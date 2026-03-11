"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Wrench, Star } from "lucide-react";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import { AdviceEmptyState } from "./advice-empty-state";
import { Badge } from "@/components/ui/badge";
import { PRIORITY_STYLES } from "@/lib/styles";
import {
  staggerContainer,
  staggerItem,
  EASE_OUT_EXPO,
} from "@/lib/animation-variants";
import type { AdviceData } from "@shared/types/advice";

interface RepoImprovementsProps {
  repoImprovements: AdviceData["repoImprovements"];
  expandAll?: boolean;
}

export function RepoImprovements({ repoImprovements, expandAll = false }: RepoImprovementsProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (repoImprovements.length === 0) {
    return (
      <AdviceEmptyState
        title="Repository Improvements"
        message="No repository improvement suggestions available for this profile."
        delay={0.06}
      />
    );
  }

  return (
    <AnimateOnView delay={0.06}>
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHeader
          title="Repository Improvements"
          subtitle="Specific upgrades for your existing repos"
        />

        <motion.div
          className="space-y-3"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {repoImprovements.map((repo) => (
            <motion.div
              key={repo.repoName}
              variants={staggerItem}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              whileHover={{ scale: 1.01, y: -1 }}
              className="rounded-md border border-border bg-background overflow-hidden transition-colors hover:border-emerald-500/20 cursor-default"
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
                  <motion.div
                    animate={{ rotate: expanded === repo.repoName ? 180 : 0 }}
                    transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
                  >
                    <ChevronDown className="size-4 text-muted-foreground" />
                  </motion.div>
                </div>
              </button>

              <AnimatePresence>
                {(expandAll || expanded === repo.repoName) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
                    className="border-t border-border overflow-hidden"
                  >
                    <motion.div
                      className="p-4 space-y-3"
                      variants={staggerContainer}
                      initial="hidden"
                      animate="visible"
                    >
                      {repo.improvements.map((imp, i) => (
                        <motion.div
                          key={`${imp.area}-${imp.priority}-${i}`}
                          variants={staggerItem}
                          className="flex gap-3"
                        >
                          <div className="mt-0.5 shrink-0">
                            <Badge className={`border text-[9px] w-14 justify-center ${PRIORITY_STYLES[imp.priority] ?? ""}`}>
                              {imp.priority}
                            </Badge>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-medium">
                              <span className="text-muted-foreground">{imp.area}:</span>{" "}
                              {imp.suggestion}
                            </p>
                            {imp.expectedOutcome && (
                              <p className="text-[11px] text-muted-foreground">
                                <span className="text-emerald-400">Outcome:</span> {imp.expectedOutcome}
                              </p>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </AnimateOnView>
  );
}
