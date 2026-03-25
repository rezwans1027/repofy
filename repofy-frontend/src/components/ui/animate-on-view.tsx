"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ReactNode } from "react";
import { EASE_OUT_EXPO } from "@/lib/animation-variants";

interface AnimateOnViewProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  variant?: "fadeUp" | "fadeIn" | "scaleIn" | "slideLeft" | "slideRight";
  /** Override the default viewport margin (e.g. "0px" to trigger at the edge). */
  viewportMargin?: string;
}

const presets: Record<string, Variants> = {
  fadeUp: {
    hidden: { opacity: 0, y: 24 },
    visible: (d: number) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, delay: d, ease: EASE_OUT_EXPO },
    }),
  },
  fadeIn: {
    hidden: { opacity: 0 },
    visible: (d: number) => ({
      opacity: 1,
      transition: { duration: 0.5, delay: d, ease: EASE_OUT_EXPO },
    }),
  },
  scaleIn: {
    hidden: { opacity: 0, scale: 0.95 },
    visible: (d: number) => ({
      opacity: 1,
      scale: 1,
      transition: { duration: 0.5, delay: d, ease: EASE_OUT_EXPO },
    }),
  },
  slideLeft: {
    hidden: { opacity: 0, x: -24 },
    visible: (d: number) => ({
      opacity: 1,
      x: 0,
      transition: { duration: 0.5, delay: d, ease: EASE_OUT_EXPO },
    }),
  },
  slideRight: {
    hidden: { opacity: 0, x: 24 },
    visible: (d: number) => ({
      opacity: 1,
      x: 0,
      transition: { duration: 0.5, delay: d, ease: EASE_OUT_EXPO },
    }),
  },
};

export function AnimateOnView({
  children,
  className,
  delay = 0,
  variant = "fadeUp",
  viewportMargin = "-60px",
}: AnimateOnViewProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      variants={presets[variant]}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: viewportMargin }}
      custom={delay}
      className={className}
    >
      {children}
    </motion.div>
  );
}
