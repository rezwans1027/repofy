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

/**
 * Renders a contribution heatmap grouped by week columns.
 * Animation is applied per-week (~52 groups) instead of per-cell (~364),
 * avoiding layout jank on slower devices.
 */
export function HeatmapGrid({ data }: HeatmapGridProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });

  // Group cells by week column: weeks[weekIndex] = [value_day0, value_day1, …, value_day6]
  const weeks = useMemo(() => {
    const numWeeks = data[0]?.length ?? 52;
    const result: number[][] = [];
    for (let week = 0; week < numWeeks; week++) {
      const column: number[] = [];
      for (let day = 0; day < data.length; day++) {
        column.push(data[day]?.[week] ?? 0);
      }
      result.push(column);
    }
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
          gridTemplateColumns: `repeat(${weeks.length}, 1fr)`,
        }}
      >
        {weeks.map((column, week) => (
          <div
            key={week}
            className={`grid gap-[3px] ${isInView ? "heatmap-cell-animate" : ""}`}
            style={{
              gridTemplateRows: "repeat(7, 1fr)",
              opacity: isInView ? undefined : 0,
              animationDelay: `${week * 14}ms`,
            }}
          >
            {column.map((value, day) => (
              <div
                key={day}
                className="aspect-square w-full min-w-[8px] rounded-[2px]"
                style={{
                  backgroundColor: COLORS[value] || COLORS[0],
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
