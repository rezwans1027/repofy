"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Calendar, CheckCircle2 } from "lucide-react";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import { Badge } from "@/components/ui/badge";
import { EASE_OUT_EXPO } from "@/lib/animation-variants";
import type { Variants } from "framer-motion";
import type { AdviceData } from "@shared/types/advice";

// ── Color system ────────────────────────────────────────────────────

const BUILD_COLORS = [
  {
    bg: "bg-emerald-500/10",
    border: "border-emerald-400/30",
    text: "text-emerald-400",
    dot: "bg-emerald-400",
    glow: "shadow-[0_0_8px_rgba(52,211,153,0.4)]",
    hoverBorder: "hover:border-emerald-400/50",
    hoverGlow: "hover:shadow-[0_0_20px_rgba(52,211,153,0.12)]",
    line: "from-emerald-400/40",
  },
  {
    bg: "bg-cyan/10",
    border: "border-cyan/30",
    text: "text-cyan",
    dot: "bg-cyan",
    glow: "shadow-[0_0_8px_rgba(34,211,238,0.4)]",
    hoverBorder: "hover:border-cyan/50",
    hoverGlow: "hover:shadow-[0_0_20px_rgba(34,211,238,0.12)]",
    line: "from-cyan/40",
  },
  {
    bg: "bg-purple-500/10",
    border: "border-purple-400/30",
    text: "text-purple-400",
    dot: "bg-purple-400",
    glow: "shadow-[0_0_8px_rgba(192,132,252,0.4)]",
    hoverBorder: "hover:border-purple-400/50",
    hoverGlow: "hover:shadow-[0_0_20px_rgba(192,132,252,0.12)]",
    line: "from-purple-400/40",
  },
];

// ── Per-row animation variants (triggered individually by scroll) ───

const rowContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};

const timelineDot: Variants = {
  hidden: { scale: 0, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { type: "spring", stiffness: 500, damping: 25 },
  },
};

const connectorLine: Variants = {
  hidden: { scaleX: 0, opacity: 0 },
  visible: {
    scaleX: 1,
    opacity: 1,
    transition: { duration: 0.3, ease: EASE_OUT_EXPO },
  },
};

const cardSlide: Variants = {
  hidden: { opacity: 0, x: 24 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.55, ease: EASE_OUT_EXPO },
  },
};

const cardContent: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: EASE_OUT_EXPO },
  },
};

const phaseDivider: Variants = {
  hidden: { opacity: 0, scaleX: 0 },
  visible: {
    opacity: 1,
    scaleX: 1,
    transition: { duration: 0.5, ease: EASE_OUT_EXPO },
  },
};

// ── Component ───────────────────────────────────────────────────────

interface WeeklyRoadmapProps {
  weeks: AdviceData["weeklyRoadmap"];
  builds: AdviceData["buildRoadmap"];
}

export function WeeklyRoadmap({ weeks, builds }: WeeklyRoadmapProps) {
  const timelineRef = useRef<HTMLDivElement>(null);

  // Scroll-driven spine progress — grows as user scrolls through the section
  const { scrollYProgress } = useScroll({
    target: timelineRef,
    offset: ["start 85%", "end 30%"],
  });
  const spineScale = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const spineOpacity = useTransform(scrollYProgress, [0, 0.05], [0, 1]);

  if (weeks.length === 0) {
    return (
      <AnimateOnView delay={0.08}>
        <div className="rounded-lg border border-border bg-card p-5">
          <SectionHeader title="12-Week Roadmap" />
          <p className="text-xs text-muted-foreground">No weekly roadmap available.</p>
        </div>
      </AnimateOnView>
    );
  }

  const buildTitleIndex = new Map(builds.map((b, i) => [b.title, i]));

  // Detect phase transitions
  const phaseChanges = new Set<number>();
  for (let i = 1; i < weeks.length; i++) {
    if (weeks[i].activeBuildTitle !== weeks[i - 1].activeBuildTitle) {
      phaseChanges.add(i);
    }
  }

  return (
    <AnimateOnView delay={0.08}>
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHeader
          title="12-Week Roadmap"
          subtitle="Your week-by-week execution plan"
        />

        <div ref={timelineRef} className="relative">
          {/* ── Scroll-driven timeline spine ──────────────────── */}
          <motion.div
            className="absolute left-[7px] top-3 bottom-3 w-px bg-gradient-to-b from-emerald-400/40 via-cyan/30 to-purple-400/40"
            style={{
              scaleY: spineScale,
              opacity: spineOpacity,
              transformOrigin: "top",
            }}
          />

          {/* ── Week rows — each independently scroll-triggered ─ */}
          <div className="space-y-0">
            {weeks.map((week, idx) => {
              const buildIdx = buildTitleIndex.get(week.activeBuildTitle) ?? 0;
              const color = BUILD_COLORS[buildIdx % BUILD_COLORS.length];
              const isPhaseStart = phaseChanges.has(idx);

              return (
                <div key={week.week}>
                  {/* Phase divider — its own scroll trigger */}
                  {isPhaseStart && (
                    <motion.div
                      className="flex items-center gap-3 py-2 pl-5 ml-2 origin-left"
                      variants={phaseDivider}
                      initial="hidden"
                      whileInView="visible"
                      viewport={{ once: true, margin: "-8%" }}
                    >
                      <div className={`h-px flex-1 bg-gradient-to-r ${color.line} to-transparent`} />
                      <span className={`font-mono text-[9px] uppercase tracking-widest ${color.text} opacity-70`}>
                        Phase {buildIdx + 1}
                      </span>
                      <div className={`h-px w-8 bg-gradient-to-l ${color.line} to-transparent`} />
                    </motion.div>
                  )}

                  {/* Timeline row: dot → connector → card (scroll-triggered) */}
                  <motion.div
                    className="flex items-stretch gap-0 py-1"
                    variants={rowContainer}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-8%" }}
                  >
                    {/* Dot */}
                    <div className="flex flex-col items-center w-4 shrink-0 relative">
                      <motion.div
                        variants={timelineDot}
                        className={`size-[9px] rounded-full ${color.dot} ${color.glow} ring-2 ring-background z-10 mt-3.5`}
                      />
                    </div>

                    {/* Connector */}
                    <motion.div
                      className={`w-3 shrink-0 mt-[17px] h-px bg-gradient-to-r ${color.line} to-transparent`}
                      variants={connectorLine}
                      style={{ transformOrigin: "left" }}
                    />

                    {/* Card */}
                    <motion.div
                      variants={cardSlide}
                      whileHover={{ scale: 1.01, y: -2 }}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 25,
                      }}
                      className={`flex-1 rounded-md border ${color.border} ${color.bg} ${color.hoverBorder} ${color.hoverGlow} p-3 space-y-2 cursor-default transition-shadow`}
                    >
                      {/* Header */}
                      <motion.div
                        className="flex items-center justify-between gap-2"
                        variants={cardContent}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Calendar className={`size-3.5 shrink-0 ${color.text}`} />
                          <span className={`font-mono text-xs font-bold ${color.text}`}>
                            W{week.week}
                          </span>
                          <Badge variant="secondary" className="text-[9px]">
                            {week.activeBuildTitle}
                          </Badge>
                        </div>
                      </motion.div>

                      {/* Focus */}
                      <motion.p
                        className="text-xs font-medium"
                        variants={cardContent}
                      >
                        {week.focus}
                      </motion.p>

                      {/* Details grid */}
                      <motion.div
                        className="grid gap-2 sm:grid-cols-2"
                        variants={cardContent}
                      >
                        <div>
                          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            Tasks
                          </span>
                          <ul className="mt-0.5 space-y-0.5">
                            {week.tasks.map((t, i) => (
                              <li
                                key={i}
                                className="text-[11px] text-muted-foreground flex gap-1.5"
                              >
                                <span className={`${color.text} shrink-0`}>
                                  &bull;
                                </span>
                                {t}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="space-y-1">
                          <div>
                            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                              Skill Task
                            </span>
                            <p className="text-[11px] text-muted-foreground">
                              {week.skillTask}
                            </p>
                          </div>
                          <div className="flex items-start gap-1.5">
                            <CheckCircle2
                              className={`size-3 shrink-0 mt-0.5 ${color.text}`}
                            />
                            <p className="text-[11px] text-muted-foreground">
                              {week.successCheck}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    </motion.div>
                  </motion.div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AnimateOnView>
  );
}
