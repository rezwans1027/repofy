"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface MetricBarProps {
  label: string;
  value: number;
  max?: number;
  color?: string;
  className?: string;
}

export function MetricBar({
  label,
  value,
  max = 100,
  color,
  className,
}: MetricBarProps) {
  const percentage = (value / max) * 100;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-muted-foreground">{label}</span>
        <span className="font-mono text-xs text-foreground">{value}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color || "var(--primary)" }}
          initial={{ width: 0 }}
          whileInView={{ width: `${percentage}%` }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
        />
      </div>
    </div>
  );
}
