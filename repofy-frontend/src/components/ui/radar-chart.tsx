"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

interface RadarChartProps {
  data: { axis: string; value: number }[];
  size?: number;
}

export function RadarChart({ data, size = 280 }: RadarChartProps) {
  const center = size / 2;
  const radius = size / 2 - 40;
  const angleSlice = (Math.PI * 2) / data.length;

  const levels = [0.2, 0.4, 0.6, 0.8, 1.0];

  const points = useMemo(() => {
    return data.map((d, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      return {
        x: center + radius * d.value * Math.cos(angle),
        y: center + radius * d.value * Math.sin(angle),
      };
    });
  }, [data, center, radius, angleSlice]);

  const pathData = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ") + " Z";

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-full max-w-[280px]">
      {/* Grid levels */}
      {levels.map((level) => {
        const levelPoints = data.map((_, i) => {
          const angle = angleSlice * i - Math.PI / 2;
          return {
            x: center + radius * level * Math.cos(angle),
            y: center + radius * level * Math.sin(angle),
          };
        });
        const d =
          levelPoints
            .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
            .join(" ") + " Z";
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
      {data.map((_, i) => {
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

      {/* Data shape */}
      <motion.path
        d={pathData}
        fill="rgba(34, 211, 238, 0.1)"
        stroke="#22D3EE"
        strokeWidth="2"
        initial={{ pathLength: 0, opacity: 0 }}
        whileInView={{ pathLength: 1, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.5, ease: "easeOut" }}
      />

      {/* Data points */}
      {points.map((p, i) => (
        <motion.circle
          key={`point-${i}`}
          cx={p.x}
          cy={p.y}
          r="4"
          fill="#22D3EE"
          initial={{ scale: 0 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3, delay: 0.5 + i * 0.1 }}
        />
      ))}

      {/* Labels */}
      {data.map((d, i) => {
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
  );
}
