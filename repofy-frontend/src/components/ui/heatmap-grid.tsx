"use client";

import { useRef, useMemo } from "react";
import { useInView } from "framer-motion";

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
        role="img"
        aria-label="Contribution heatmap showing activity levels over time"
        className="grid gap-[3px]"
        style={{
          gridTemplateColumns: `repeat(${data[0]?.length ?? 52}, 1fr)`,
          gridTemplateRows: `repeat(7, 1fr)`,
        }}
      >
        {cells.map(({ day, week, value }) => {
          const delay = (week * 7 + day) * 2;
          return (
            <div
              key={`${day}-${week}`}
              className={`aspect-square w-full min-w-[8px] rounded-[2px] ${isInView ? "heatmap-cell-animate" : ""}`}
              style={{
                backgroundColor: COLORS[value] || COLORS[0],
                opacity: isInView ? undefined : 0,
                animationDelay: `${delay}ms`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
