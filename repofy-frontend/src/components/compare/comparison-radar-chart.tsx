"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { SectionHeader } from "@/components/ui/section-header";

interface RadarAxis {
  axis: string;
  value: number;
}

interface ComparisonRadarChartProps {
  dataA: RadarAxis[];
  dataB: RadarAxis[];
  usernameA: string;
  usernameB: string;
  breakdownA: { label: string; score: number; note: string }[];
  breakdownB: { label: string; score: number; note: string }[];
}

export function ComparisonRadarChart({
  dataA,
  dataB,
  usernameA,
  usernameB,
  breakdownA,
  breakdownB,
}: ComparisonRadarChartProps) {
  const size = 280;
  const center = size / 2;
  const radius = size / 2 - 40;
  const angleSlice = (Math.PI * 2) / dataA.length;
  const levels = [0.2, 0.4, 0.6, 0.8, 1.0];

  const [hovered, setHovered] = useState<"A" | "B" | null>(null);

  // Build a lookup of B values keyed by axis label so comparisons are
  // correct even if the backend returns axes in a different order.
  const bByLabel = useMemo(
    () => new Map(dataB.map((d) => [d.axis, d])),
    [dataB],
  );

  // Normalised B data aligned to A's axis order (fallback to 0)
  const alignedB = useMemo(
    () =>
      dataA.map((d) => bByLabel.get(d.axis) ?? { axis: d.axis, value: 0 }),
    [dataA, bByLabel],
  );

  const pointsA = useMemo(
    () =>
      dataA.map((d, i) => {
        const angle = angleSlice * i - Math.PI / 2;
        return {
          x: center + radius * d.value * Math.cos(angle),
          y: center + radius * d.value * Math.sin(angle),
        };
      }),
    [dataA, center, radius, angleSlice]
  );

  const pointsB = useMemo(
    () =>
      alignedB.map((d, i) => {
        const angle = angleSlice * i - Math.PI / 2;
        return {
          x: center + radius * d.value * Math.cos(angle),
          y: center + radius * d.value * Math.sin(angle),
        };
      }),
    [alignedB, center, radius, angleSlice]
  );

  const toPath = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

  const pathA = toPath(pointsA);
  const pathB = toPath(pointsB);

  const fillOpacityA = hovered === "B" ? 0.03 : hovered === "A" ? 0.2 : 0.08;
  const fillOpacityB = hovered === "A" ? 0.03 : hovered === "B" ? 0.2 : 0.08;
  const strokeOpacityA = hovered === "B" ? 0.3 : 1;
  const strokeOpacityB = hovered === "A" ? 0.3 : 1;

  return (
    <div data-testid="comparison-radar" className="rounded-lg border border-border bg-card p-5">
      <SectionHeader
        title="Developer DNA Comparison"
        subtitle="6-axis capability overlay"
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <svg
            viewBox={`0 0 ${size} ${size}`}
            className="mx-auto w-full max-w-[280px]"
            style={{ overflow: "visible" }}
          >
            {/* Grid levels */}
            {levels.map((level) => {
              const levelPoints = dataA.map((_, i) => {
                const angle = angleSlice * i - Math.PI / 2;
                return {
                  x: center + radius * level * Math.cos(angle),
                  y: center + radius * level * Math.sin(angle),
                };
              });
              const d = toPath(levelPoints);
              return (
                <path
                  key={level}
                  d={d}
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth="1"
                  opacity={0.5}
                />
              );
            })}

            {/* Axis lines */}
            {dataA.map((_, i) => {
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

            {/* Shape A (cyan) */}
            <motion.path
              d={pathA}
              fill={`rgba(34, 211, 238, ${fillOpacityA})`}
              stroke="#22D3EE"
              strokeWidth="2"
              strokeOpacity={strokeOpacityA}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              onMouseEnter={() => setHovered("A")}
              onMouseLeave={() => setHovered(null)}
              className="cursor-pointer"
            />

            {/* Shape B (violet) */}
            <motion.path
              d={pathB}
              fill={`rgba(167, 139, 250, ${fillOpacityB})`}
              stroke="#A78BFA"
              strokeWidth="2"
              strokeOpacity={strokeOpacityB}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
              onMouseEnter={() => setHovered("B")}
              onMouseLeave={() => setHovered(null)}
              className="cursor-pointer"
            />

            {/* Data points A */}
            {pointsA.map((p, i) => (
              <motion.circle
                key={`a-${i}`}
                cx={p.x}
                cy={p.y}
                r="3"
                fill="#22D3EE"
                opacity={hovered === "B" ? 0.3 : 1}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3, delay: 0.5 + i * 0.1 }}
              />
            ))}

            {/* Data points B */}
            {pointsB.map((p, i) => (
              <motion.circle
                key={`b-${i}`}
                cx={p.x}
                cy={p.y}
                r="3"
                fill="#A78BFA"
                opacity={hovered === "A" ? 0.3 : 1}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3, delay: 0.8 + i * 0.1 }}
              />
            ))}

            {/* Labels */}
            {dataA.map((d, i) => {
              const angle = angleSlice * i - Math.PI / 2;
              const labelRadius = radius + 24;
              const x = center + labelRadius * Math.cos(angle);
              const y = center + labelRadius * Math.sin(angle);
              return (
                <text
                  key={`label-${i}`}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-muted-foreground font-mono text-[10px]"
                >
                  {d.axis}
                </text>
              );
            })}
          </svg>

          {/* Legend */}
          <div className="mt-3 flex items-center justify-center gap-6">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-cyan" />
              <span className="font-mono text-xs text-muted-foreground">@{usernameA}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-violet-400" />
              <span className="font-mono text-xs text-muted-foreground">@{usernameB}</span>
            </div>
          </div>
        </div>

        {/* Breakdown table */}
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Axis</span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-cyan text-right">A</span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-violet-400 text-right">B</span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground text-right">Delta</span>

            {breakdownA.map((axA) => {
              const axB = breakdownB.find((b) => b.label === axA.label);
              const delta = +(axA.score - (axB?.score ?? 0)).toFixed(1);
              const deltaColor = delta > 0 ? "text-cyan" : delta < 0 ? "text-violet-400" : "text-muted-foreground";
              return (
                <div key={axA.label} className="contents">
                  <span className="font-mono text-xs">{axA.label}</span>
                  <span className="font-mono text-xs text-cyan text-right">{axA.score}</span>
                  <span className="font-mono text-xs text-violet-400 text-right">{axB?.score ?? "—"}</span>
                  <span className={`font-mono text-xs text-right ${deltaColor}`}>
                    {delta > 0 ? "+" : ""}{delta}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
