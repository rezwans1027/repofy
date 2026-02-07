"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface AnimateOnViewProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export function AnimateOnView({
  children,
  className,
  delay = 0,
}: AnimateOnViewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
