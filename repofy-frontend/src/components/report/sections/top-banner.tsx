"use client";

import { motion } from "framer-motion";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { CountUp } from "@/components/ui/count-up";
import { Badge } from "@/components/ui/badge";
import type { ReportData } from "@/components/report/analysis-report";
import { recommendationStyle } from "@/lib/styles";

interface TopBannerProps {
  username: string;
  avatarUrl?: string;
  data: ReportData;
}

export function TopBanner({ username, avatarUrl, data }: TopBannerProps) {
  const scoreColor =
    data.overallScore >= 80
      ? "text-emerald-400"
      : data.overallScore >= 60
        ? "text-yellow-400"
        : "text-red-400";

  const recColor = recommendationStyle(data.recommendation);

  return (
    <AnimateOnView delay={0}>
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={username}
                  className="h-16 w-16 rounded-full border-2 border-cyan/30"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-cyan/30 bg-secondary font-mono text-xl font-bold text-cyan">
                  {username.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <h1 className="font-mono text-lg font-bold tracking-tight">
                @{username}
              </h1>
              <p className="font-mono text-sm text-muted-foreground">
                Developer Report
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <Badge className="bg-cyan/15 text-cyan border border-cyan/30 text-[10px]">
                  {data.candidateLevel}
                </Badge>
                <Badge className={`border text-[10px] ${recColor}`}>
                  {data.recommendation}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:flex-col sm:items-end">
            <div className="relative flex h-20 w-20 items-center justify-center">
              <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90">
                <circle
                  cx="50" cy="50" r="42"
                  fill="none"
                  stroke="var(--secondary)"
                  strokeWidth="6"
                />
                <motion.circle
                  cx="50" cy="50" r="42"
                  fill="none"
                  stroke="#22D3EE"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                  animate={{
                    strokeDashoffset:
                      2 * Math.PI * 42 * (1 - data.overallScore / 100),
                  }}
                  transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
                />
              </svg>
              <span className={`font-mono text-xl font-bold ${scoreColor}`}>
                <CountUp end={data.overallScore} />
              </span>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              Overall Score
            </span>
          </div>
        </div>
      </div>
    </AnimateOnView>
  );
}
