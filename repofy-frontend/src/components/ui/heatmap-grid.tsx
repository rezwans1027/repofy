"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { useMemo } from "react";

interface HeatmapGridProps {
  data: number[][];
}

const COLORS = [
  "var(--secondary)",
  "#064E3B",
  "#065F46",
  "#047857",
  "#22D3EE",
];

export function HeatmapGrid({ data }: HeatmapGridProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });

  const cells = useMemo(() => {
    const result: { day: number; week: number; value: number }[] = [];
    data.forEach((row, day) => {
      row.forEach((value, week) => {
        result.push({ day, week, value });
      });
    });
    return result;
  }, [data]);

  return (
    <div className="overflow-x-auto">
      <div
        ref={ref}
        className="grid gap-[3px]"
        style={{
          gridTemplateColumns: `repeat(52, 1fr)`,
          gridTemplateRows: `repeat(7, 1fr)`,
        }}
      >
        {cells.map(({ day, week, value }) => (
          <motion.div
            key={`${day}-${week}`}
            className="aspect-square w-full min-w-[8px] rounded-[2px]"
            style={{ backgroundColor: COLORS[value] || COLORS[0] }}
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : undefined}
            transition={{
              duration: 0.15,
              delay: (week * 7 + day) * 0.002,
            }}
          />
        ))}
      </div>
    </div>
  );
}
