"use client";

import { motion } from "framer-motion";

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
}

export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <div className="mb-4 overflow-hidden">
      <h2 className="font-mono text-base font-bold tracking-tight sm:text-lg flex items-center">
        <motion.span
          initial={{ scale: 0, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{
            type: "spring",
            stiffness: 500,
            damping: 25,
            delay: 0.1,
          }}
          className="text-cyan mr-2 inline-block origin-center"
        >
          .
        </motion.span>
        <motion.span
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.15, ease: EASE_OUT_EXPO }}
          className="inline-block"
        >
          {title}
        </motion.span>
      </h2>
      {subtitle && (
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.35, delay: 0.25 }}
          className="text-muted-foreground mt-1 text-xs"
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  );
}
