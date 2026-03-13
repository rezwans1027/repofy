"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ReactNode } from "react";

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

interface AnimateOnViewProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  variant?: "fadeUp" | "fadeIn" | "scaleIn" | "slideLeft" | "slideRight";
}

const presets: Record<string, Variants> = {
  fadeUp: {
    hidden: { opacity: 0, y: 24, filter: "blur(6px)" },
    visible: (d: number) => ({
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { duration: 0.6, delay: d, ease: EASE_OUT_EXPO },
    }),
  },
  fadeIn: {
    hidden: { opacity: 0, filter: "blur(6px)" },
    visible: (d: number) => ({
      opacity: 1,
      filter: "blur(0px)",
      transition: { duration: 0.5, delay: d, ease: EASE_OUT_EXPO },
    }),
  },
  scaleIn: {
    hidden: { opacity: 0, scale: 0.95, filter: "blur(4px)" },
    visible: (d: number) => ({
      opacity: 1,
      scale: 1,
      filter: "blur(0px)",
      transition: { duration: 0.5, delay: d, ease: EASE_OUT_EXPO },
    }),
  },
  slideLeft: {
    hidden: { opacity: 0, x: -24, filter: "blur(4px)" },
    visible: (d: number) => ({
      opacity: 1,
      x: 0,
      filter: "blur(0px)",
      transition: { duration: 0.5, delay: d, ease: EASE_OUT_EXPO },
    }),
  },
  slideRight: {
    hidden: { opacity: 0, x: 24, filter: "blur(4px)" },
    visible: (d: number) => ({
      opacity: 1,
      x: 0,
      filter: "blur(0px)",
      transition: { duration: 0.5, delay: d, ease: EASE_OUT_EXPO },
    }),
  },
};

export function AnimateOnView({
  children,
  className,
  delay = 0,
  variant = "fadeUp",
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
      viewport={{ once: true, margin: "-60px" }}
      custom={delay}
      className={className}
    >
      {children}
    </motion.div>
  );
}
