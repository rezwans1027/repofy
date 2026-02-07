"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface DiffLine {
  type: "add" | "remove";
  text: string;
}

interface DiffBlockProps {
  lines: DiffLine[];
  delay?: number;
}

export function DiffBlock({ lines, delay = 0 }: DiffBlockProps) {
  return (
    <div className="space-y-1 font-mono text-sm">
      {lines.map((line, i) => (
        <motion.div
          key={i}
          className={cn(
            "rounded px-3 py-1",
            line.type === "add"
              ? "bg-diff-add-bg text-diff-add"
              : "bg-diff-remove-bg text-diff-remove"
          )}
          initial={{ opacity: 0, x: line.type === "add" ? 20 : -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: delay + i * 0.15 }}
        >
          {line.text}
        </motion.div>
      ))}
    </div>
  );
}
