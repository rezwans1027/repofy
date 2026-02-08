"use client";

import { useMemo } from "react";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Trophy, ArrowUp } from "lucide-react";

const candidateA = {
  name: "Alex Chen",
  username: "alexchendev",
  score: 82,
  level: "Senior",
  recommendation: "Strong Hire",
  axes: [
    { axis: "Code Quality", value: 0.87 },
    { axis: "Complexity", value: 0.78 },
    { axis: "Breadth", value: 0.82 },
    { axis: "Practices", value: 0.74 },
    { axis: "Consistency", value: 0.91 },
    { axis: "Collaboration", value: 0.68 },
  ],
};

const candidateB = {
  name: "Sam Rivera",
  username: "samrivera",
  score: 74,
  level: "Mid-Level",
  recommendation: "Hire",
  axes: [
    { axis: "Code Quality", value: 0.72 },
    { axis: "Complexity", value: 0.65 },
    { axis: "Breadth", value: 0.88 },
    { axis: "Practices", value: 0.81 },
    { axis: "Consistency", value: 0.7 },
    { axis: "Collaboration", value: 0.85 },
  ],
};

const stats = [
  { label: "Repos", a: 47, b: 62 },
  { label: "Stars", a: 2340, b: 890 },
  { label: "Followers", a: 891, b: 1205 },
  { label: "Contributions", a: 1847, b: 2103 },
];

function DualRadarChart() {
  const size = 260;
  const center = size / 2;
  const radius = size / 2 - 36;
  const angleSlice = (Math.PI * 2) / 6;
  const levels = [0.2, 0.4, 0.6, 0.8, 1.0];

  const getPoints = (axes: { axis: string; value: number }[]) =>
    axes.map((d, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      return {
        x: center + radius * d.value * Math.cos(angle),
        y: center + radius * d.value * Math.sin(angle),
      };
    });

  const pointsA = useMemo(() => getPoints(candidateA.axes), []);
  const pointsB = useMemo(() => getPoints(candidateB.axes), []);

  const toPath = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-full max-w-[260px]" style={{ overflow: "visible" }}>
      {levels.map((level) => {
        const pts = candidateA.axes.map((_, i) => {
          const angle = angleSlice * i - Math.PI / 2;
          return {
            x: center + radius * level * Math.cos(angle),
            y: center + radius * level * Math.sin(angle),
          };
        });
        return (
          <path
            key={level}
            d={toPath(pts)}
            fill="none"
            stroke="var(--border)"
            strokeWidth="1"
            opacity={0.5}
          />
        );
      })}
      {candidateA.axes.map((_, i) => {
        const angle = angleSlice * i - Math.PI / 2;
        return (
          <line
            key={`axis-${i}`}
            x1={center}
            y1={center}
            x2={center + radius * Math.cos(angle)}
            y2={center + radius * Math.sin(angle)}
            stroke="var(--border)"
            strokeWidth="1"
            opacity={0.3}
          />
        );
      })}
      {/* Candidate A shape - cyan */}
      <motion.path
        d={toPath(pointsA)}
        fill="rgba(34, 211, 238, 0.12)"
        stroke="#22D3EE"
        strokeWidth="2"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
      />
      {/* Candidate B shape - violet */}
      <motion.path
        d={toPath(pointsB)}
        fill="rgba(167, 139, 250, 0.12)"
        stroke="#A78BFA"
        strokeWidth="2"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, delay: 0.2 }}
      />
      {/* Labels */}
      {candidateA.axes.map((d, i) => {
        const angle = angleSlice * i - Math.PI / 2;
        const labelRadius = radius + 22;
        return (
          <text
            key={`label-${i}`}
            x={center + labelRadius * Math.cos(angle)}
            y={center + labelRadius * Math.sin(angle)}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-muted-foreground font-mono text-[9px]"
          >
            {d.axis}
          </text>
        );
      })}
    </svg>
  );
}

export function ComparePreview() {
  return (
    <section id="compare" className="py-20">
      <AnimateOnView>
        <SectionHeader
          title="Candidate Comparison"
          subtitle="Compare two developers side-by-side. Every dimension. One page."
        />
      </AnimateOnView>

      {/* Candidate headers + score bar */}
      <AnimateOnView delay={0.1}>
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan/30 bg-cyan/10 font-mono text-sm text-cyan">
                AC
              </div>
              <div>
                <span className="font-mono text-sm font-bold">
                  @{candidateA.username}
                </span>
                <div className="flex gap-1.5 mt-0.5">
                  <Badge className="bg-cyan/10 text-cyan border-cyan/20 font-mono text-[9px]">
                    {candidateA.level}
                  </Badge>
                  <Badge className="bg-cyan/10 text-cyan border-cyan/20 font-mono text-[9px]">
                    {candidateA.recommendation}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="hidden items-center gap-2 sm:flex">
              <Trophy className="h-4 w-4 text-amber-400" />
              <span className="text-muted-foreground font-mono text-xs">
                +{candidateA.score - candidateB.score} pts
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="font-mono text-sm font-bold">
                  @{candidateB.username}
                </span>
                <div className="flex justify-end gap-1.5 mt-0.5">
                  <Badge className="bg-violet-400/10 text-violet-400 border-violet-400/20 font-mono text-[9px]">
                    {candidateB.level}
                  </Badge>
                  <Badge className="bg-violet-400/10 text-violet-400 border-violet-400/20 font-mono text-[9px]">
                    {candidateB.recommendation}
                  </Badge>
                </div>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-violet-400/30 bg-violet-400/10 font-mono text-sm text-violet-400">
                SR
              </div>
            </div>
          </div>

          {/* Score comparison bar */}
          <div className="mt-5">
            <div className="flex items-center justify-between font-mono text-xs">
              <span className="text-cyan">{candidateA.score}</span>
              <span className="text-muted-foreground">Overall Score</span>
              <span className="text-violet-400">{candidateB.score}</span>
            </div>
            <div className="mt-1.5 flex h-2.5 overflow-hidden rounded-full">
              <motion.div
                className="h-full rounded-l-full bg-cyan"
                initial={{ width: 0 }}
                whileInView={{
                  width: `${(candidateA.score / (candidateA.score + candidateB.score)) * 100}%`,
                }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
              />
              <motion.div
                className="h-full rounded-r-full bg-violet-400"
                initial={{ width: 0 }}
                whileInView={{
                  width: `${(candidateB.score / (candidateA.score + candidateB.score)) * 100}%`,
                }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.1 }}
              />
            </div>
          </div>
        </div>
      </AnimateOnView>

      {/* Dual Radar + Stats */}
      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr]">
        <AnimateOnView delay={0.15}>
          <div className="h-full rounded-lg border border-border bg-card p-6">
            <p className="text-muted-foreground mb-2 font-mono text-xs">
              Overlaid radar comparison
            </p>
            <DualRadarChart />
            <div className="mt-4 flex items-center justify-center gap-6">
              <div className="flex items-center gap-2">
                <span className="h-2 w-6 rounded-full bg-cyan" />
                <span className="text-muted-foreground font-mono text-[10px]">
                  {candidateA.username}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-6 rounded-full bg-violet-400" />
                <span className="text-muted-foreground font-mono text-[10px]">
                  {candidateB.username}
                </span>
              </div>
            </div>
          </div>
        </AnimateOnView>

        <AnimateOnView delay={0.2}>
          <div className="h-full rounded-lg border border-border bg-card p-6">
            <p className="text-muted-foreground mb-4 font-mono text-xs">
              Stats comparison
            </p>
            <div className="space-y-4">
              {stats.map((stat) => {
                const winner = stat.a > stat.b ? "a" : stat.b > stat.a ? "b" : null;
                return (
                  <div key={stat.label}>
                    <div className="flex items-center justify-between font-mono text-xs">
                      <span className={winner === "a" ? "text-cyan font-bold" : "text-muted-foreground"}>
                        {stat.a.toLocaleString()}
                        {winner === "a" && (
                          <ArrowUp className="ml-1 inline h-3 w-3 text-cyan" />
                        )}
                      </span>
                      <span className="text-muted-foreground">{stat.label}</span>
                      <span className={winner === "b" ? "text-violet-400 font-bold" : "text-muted-foreground"}>
                        {winner === "b" && (
                          <ArrowUp className="mr-1 inline h-3 w-3 text-violet-400" />
                        )}
                        {stat.b.toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1.5 flex gap-1">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                        <motion.div
                          className="h-full rounded-full bg-cyan"
                          initial={{ width: 0 }}
                          whileInView={{
                            width: `${(stat.a / Math.max(stat.a, stat.b)) * 100}%`,
                          }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.8 }}
                        />
                      </div>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                        <motion.div
                          className="ml-auto h-full rounded-full bg-violet-400"
                          initial={{ width: 0 }}
                          whileInView={{
                            width: `${(stat.b / Math.max(stat.a, stat.b)) * 100}%`,
                          }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.8, delay: 0.1 }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Axis breakdown */}
            <div className="mt-6 border-t border-border pt-4">
              <p className="text-muted-foreground mb-3 font-mono text-[10px]">
                Axis deltas
              </p>
              {candidateA.axes.map((a, i) => {
                const delta = Math.round((a.value - candidateB.axes[i].value) * 100);
                return (
                  <div
                    key={a.axis}
                    className="flex items-center justify-between py-1 font-mono text-[10px]"
                  >
                    <span className="text-muted-foreground">{a.axis}</span>
                    <span
                      className={
                        delta > 0
                          ? "text-cyan"
                          : delta < 0
                            ? "text-violet-400"
                            : "text-muted-foreground"
                      }
                    >
                      {delta > 0 ? "+" : ""}
                      {delta}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </AnimateOnView>
      </div>

      <AnimateOnView delay={0.25}>
        <p className="text-muted-foreground mt-6 text-center font-mono text-xs">
          Comparisons also include language profiles, top repos side-by-side,
          strengths vs weaknesses, and exportable PDF.
        </p>
      </AnimateOnView>
    </section>
  );
}
