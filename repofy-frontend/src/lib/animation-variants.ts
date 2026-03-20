import type { Variants } from "framer-motion";

export const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

// ── Stagger containers ─────────────────────────────────────────────

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07, delayChildren: 0.1 },
  },
};

export const staggerContainerFast: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.05, delayChildren: 0.05 },
  },
};

// ── Stagger item variants ──────────────────────────────────────────

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: EASE_OUT_EXPO },
  },
};

export const staggerItemScale: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, ease: EASE_OUT_EXPO },
  },
};

export const staggerItemLeft: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: EASE_OUT_EXPO },
  },
};

export const staggerItemRight: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: EASE_OUT_EXPO },
  },
};

// ── Badge / pop variants ───────────────────────────────────────────

export const badgePop: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.3, ease: EASE_OUT_EXPO },
  },
};

// ── Internal content fade (for text within cards) ──────────────────

export const contentFade: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.4, delay: 0.25 },
  },
};

// ── Border grow (for animated left-border accents) ──────────────────

export const borderGrow: Variants = {
  hidden: { height: 0 },
  visible: {
    height: "100%",
    transition: { duration: 0.6, delay: 0.15, ease: EASE_OUT_EXPO },
  },
};

// ── Tab content (direction-aware) ──────────────────────────────────

export const tabContentVariants: Variants = {
  enter: (direction: number | null) => ({
    x: direction == null ? 0 : direction > 0 ? 30 : -30,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.35, ease: EASE_OUT_EXPO },
  },
  exit: (direction: number | null) => ({
    x: direction != null && direction > 0 ? -30 : 30,
    opacity: 0,
    transition: { duration: 0.2 },
  }),
};
