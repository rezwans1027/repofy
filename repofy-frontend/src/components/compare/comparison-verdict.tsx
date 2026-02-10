"use client";

import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ReportData } from "@/components/report/analysis-report";
import { recommendationStyle } from "@/lib/styles";

interface ComparisonVerdictProps {
  usernameA: string;
  usernameB: string;
  reportA: ReportData;
  reportB: ReportData;
}

function generateDifferentiators(a: ReportData, b: ReportData): string[] {
  const bullets: string[] = [];

  // Compare radar axes — find the 2 largest gaps
  const axisGaps = a.radarAxes.map((axA, i) => {
    const axB = b.radarAxes[i];
    return {
      axis: axA.axis,
      delta: Math.round((axA.value - (axB?.value ?? 0)) * 100),
    };
  });
  axisGaps.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));

  const top2 = axisGaps.slice(0, 2);
  for (const gap of top2) {
    if (Math.abs(gap.delta) < 3) continue;
    const winner = gap.delta > 0 ? "A" : "B";
    const loser = winner === "A" ? "B" : "A";
    bullets.push(
      `Candidate ${winner} leads in ${gap.axis} by ${Math.abs(gap.delta)} points over Candidate ${loser}`
    );
  }

  // Compare stats
  if (a.stats.stars !== b.stats.stars) {
    const ratio = Math.max(a.stats.stars, b.stats.stars) / Math.max(Math.min(a.stats.stars, b.stats.stars), 1);
    if (ratio > 1.5) {
      const winner = a.stats.stars > b.stats.stars ? "A" : "B";
      bullets.push(`Candidate ${winner} has significantly more community traction (stars)`);
    }
  }

  if (bullets.length === 0) {
    bullets.push("Both candidates show comparable skill profiles across all axes");
  }

  return bullets.slice(0, 3);
}

export function ComparisonVerdict({
  usernameA,
  usernameB,
  reportA,
  reportB,
}: ComparisonVerdictProps) {
  const scoreA = reportA.overallScore;
  const scoreB = reportB.overallScore;
  const total = scoreA + scoreB;
  const pctA = total > 0 ? (scoreA / total) * 100 : 50;
  const delta = Math.abs(scoreA - scoreB);
  const isClose = delta <= 2;

  const winner = scoreA > scoreB ? "A" : scoreB > scoreA ? "B" : null;
  const winnerUsername = winner === "A" ? usernameA : winner === "B" ? usernameB : null;

  const scoreColor = (score: number) =>
    score >= 80 ? "text-emerald-400" : score >= 60 ? "text-yellow-400" : "text-red-400";

  const recStyle = recommendationStyle;

  const differentiators = generateDifferentiators(reportA, reportB);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-lg border border-border bg-card p-5"
    >
      {/* Avatars + info row */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        {/* Candidate A */}
        <div className="flex items-center gap-3">
          <img
            src={`https://github.com/${usernameA}.png`}
            alt={usernameA}
            className="h-14 w-14 rounded-full border-2 border-cyan/40"
          />
          <div>
            <p className="font-mono text-sm font-bold text-cyan">@{usernameA}</p>
            <div className="mt-1 flex items-center gap-1.5">
              <Badge className="bg-cyan/15 text-cyan border border-cyan/30 text-[9px]">
                {reportA.candidateLevel}
              </Badge>
              <Badge className={`border text-[9px] ${recStyle(reportA.recommendation)}`}>
                {reportA.recommendation}
              </Badge>
            </div>
          </div>
        </div>

        {/* VS */}
        <div className="hidden sm:flex items-center">
          <span className="font-mono text-lg font-bold text-muted-foreground/40">vs</span>
        </div>

        {/* Candidate B */}
        <div className="flex items-center gap-3">
          <img
            src={`https://github.com/${usernameB}.png`}
            alt={usernameB}
            className="h-14 w-14 rounded-full border-2 border-violet-400/40"
          />
          <div>
            <p className="font-mono text-sm font-bold text-violet-400">@{usernameB}</p>
            <div className="mt-1 flex items-center gap-1.5">
              <Badge className="bg-violet-400/15 text-violet-400 border border-violet-400/30 text-[9px]">
                {reportB.candidateLevel}
              </Badge>
              <Badge className={`border text-[9px] ${recStyle(reportB.recommendation)}`}>
                {reportB.recommendation}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Score comparison bar */}
      <div className="mt-5 space-y-2">
        <div className="flex items-center justify-between">
          <span className={`font-mono text-lg font-bold ${scoreColor(scoreA)}`}>{scoreA}</span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Overall Score
          </span>
          <span className={`font-mono text-lg font-bold ${scoreColor(scoreB)}`}>{scoreB}</span>
        </div>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-secondary">
          <motion.div
            className="h-full rounded-l-full bg-cyan"
            initial={{ width: "50%" }}
            animate={{ width: `${pctA}%` }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
          />
          <motion.div
            className="h-full rounded-r-full bg-violet-400"
            initial={{ width: "50%" }}
            animate={{ width: `${100 - pctA}%` }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
          />
        </div>
      </div>

      {/* Winner indicator */}
      <div className="mt-4 flex items-center justify-center gap-2">
        {isClose ? (
          <span className="font-mono text-xs text-muted-foreground">
            Closely Matched (within {delta} points)
          </span>
        ) : (
          <>
            <Trophy className="size-4 text-amber-400" />
            <span className="font-mono text-xs">
              <span className={winner === "A" ? "text-cyan" : "text-violet-400"}>
                @{winnerUsername}
              </span>{" "}
              <span className="text-muted-foreground">
                leads by {delta} points
              </span>
            </span>
          </>
        )}
      </div>

      {/* Differentiators */}
      <div className="mt-4 space-y-1.5">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Key Differentiators
        </p>
        {differentiators.map((d, i) => (
          <p key={i} className="text-xs text-muted-foreground">
            <span className="text-cyan mr-1.5">•</span>
            {d}
          </p>
        ))}
      </div>
    </motion.div>
  );
}
