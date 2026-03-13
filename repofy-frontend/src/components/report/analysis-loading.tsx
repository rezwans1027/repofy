"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Terminal } from "lucide-react";

/* ── Constants ──────────────────────────────────────────────────── */

const DEFAULT_PHASES = [
  "Scanning profile...",
  "Reading top repositories...",
  "Indexing language usage...",
  "Analyzing code patterns...",
  "Evaluating contributions...",
  "Mapping technical skills...",
  "Scoring developer profile...",
  "Generating report...",
];

const REPORT_LOG: string[][] = [
  ["Initializing analysis engine", "Connecting to GitHub API", "Fetching profile metadata", "Reading bio and account age"],
  ["Enumerating public repositories", "Sorting by star count and recency", "Cloning top repository manifests", "Parsing dependency graphs"],
  ["Detecting primary languages", "Measuring language diversity", "Comparing to ecosystem averages", "Indexing framework usage"],
  ["Scanning commit frequency", "Analyzing code review activity", "Evaluating PR merge patterns", "Assessing code quality signals"],
  ["Mapping contribution heatmap", "Calculating consistency score", "Measuring open-source impact", "Reviewing collaboration patterns"],
  ["Building technical skill matrix", "Cross-referencing with industry benchmarks", "Weighting skill proficiency levels", "Identifying specialization areas"],
  ["Computing overall developer score", "Ranking against peer cohort", "Calibrating confidence intervals", "Validating scoring model"],
  ["Synthesizing analysis results", "Formatting insights and charts", "Compiling recommendations", "Finalizing report output"],
];

const ADVISOR_LOG: string[][] = [
  ["Initializing advisor engine", "Connecting to GitHub API", "Loading developer profile", "Reading activity history"],
  ["Mapping current skill level", "Comparing career archetypes", "Identifying growth vectors", "Assessing learning velocity"],
  ["Analyzing market demand signals", "Ranking high-impact skills", "Filtering by career alignment", "Prioritizing skill gaps"],
  ["Evaluating project complexity", "Matching to skill targets", "Scoping realistic milestones", "Designing build sequence"],
  ["Planning 12-week progression", "Balancing difficulty curve", "Inserting recovery weeks", "Selecting project templates"],
  ["Writing weekly learning objectives", "Adding resource recommendations", "Linking documentation and courses", "Setting measurable checkpoints"],
  ["Running roadmap coherence check", "Validating prerequisite chains", "Adjusting pacing for workload", "Stress-testing timeline feasibility"],
  ["Formatting personalized roadmap", "Compiling action items", "Generating summary insights", "Finalizing growth plan"],
];

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const BAR_COUNT = 48;

/* ── Types ──────────────────────────────────────────────────────── */

interface AnalysisLoadingProps {
  fetchReport: () => Promise<unknown>;
  onComplete: (data: unknown) => void;
  onError: (message: string) => void;
  phases?: string[];
  accentColor?: string;
  title?: string;
}

interface LogEntry {
  id: number;
  time: string;
  text: string;
}

function formatTime(d: Date) {
  return (
    String(d.getHours()).padStart(2, "0") +
    ":" +
    String(d.getMinutes()).padStart(2, "0") +
    ":" +
    String(d.getSeconds()).padStart(2, "0")
  );
}

/* ── Component ──────────────────────────────────────────────────── */

export function AnalysisLoading({
  fetchReport,
  onComplete,
  onError,
  phases: phasesProp,
  accentColor,
  title,
}: AnalysisLoadingProps) {
  const phases = phasesProp ?? DEFAULT_PHASES;
  const [phase, setPhase] = useState(0);
  const [fading, setFading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const fetchStarted = useRef(false);
  const logId = useRef(0);

  const isAdvisor = accentColor?.includes("emerald");
  const hex = isAdvisor ? "#34d399" : "#22d3ee";
  const accentCls = isAdvisor ? "text-emerald-400" : "text-cyan";
  const logPool = isAdvisor ? ADVISOR_LOG : REPORT_LOG;
  const complete = phase >= phases.length;
  const displayProgress = complete
    ? 100
    : elapsed < 90
      ? (elapsed / 90) * 94
      : 94 + Math.min(((elapsed - 90) / 30) * 4, 4);

  /* Elapsed timer — ticks every 100 ms */
  useEffect(() => {
    const t0 = Date.now();
    const id = setInterval(() => setElapsed((Date.now() - t0) / 1000), 100);
    return () => clearInterval(id);
  }, []);

  /* Phase progression — spread evenly across 45 s */
  useEffect(() => {
    setPhase(0);
    const interval = 90000 / phases.length; // ~11.25 s per phase
    const t = phases.map((_, i) =>
      setTimeout(() => setPhase(i), i * interval + 800),
    );
    return () => t.forEach(clearTimeout);
  }, [phases]);

  /* Activity log — 3 messages per phase, spread within each phase window */
  useEffect(() => {
    if (phase >= phases.length) {
      setLogs((p) => [
        ...p,
        { id: logId.current++, time: formatTime(new Date()), text: "Analysis complete" },
      ]);
      return;
    }

    const msgs = logPool[phase] ?? [];
    const interval = 90000 / phases.length; // phase window duration
    const gap = interval / (msgs.length + 1); // space messages evenly within window
    const timers = msgs.map((text, i) =>
      setTimeout(() => {
        setLogs((p) => [
          ...p,
          { id: logId.current++, time: formatTime(new Date()), text },
        ]);
      }, gap * (i + 1)),
    );
    return () => timers.forEach(clearTimeout);
  }, [phase, phases.length, logPool]);

  /* Fetch + progress bar */
  useEffect(() => {
    if (fetchStarted.current) return;
    fetchStarted.current = true;

    const t0 = Date.now();
    const MIN = 3000;
    let res: { data?: unknown; error?: string } | null = null;
    let dead = false;

    fetchReport()
      .then((d) => {
        res = { data: d };
      })
      .catch((err) => {
        res = {
          error: err instanceof Error ? err.message : "Analysis failed",
        };
      })
      .finally(() => {
        if (dead) return;
        const wait = Math.max(MIN - (Date.now() - t0), 0);
        setTimeout(() => {
          if (dead) return;
          dead = true;
          if (res?.error) {
            onError(res.error);
            return;
          }
          setPhase(phases.length);
          setTimeout(() => setFading(true), 400);
          setTimeout(() => onComplete(res!.data), 800);
        }, wait);
      });

    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Only show the last 4 log entries */
  const visibleLogs = logs.slice(-4);

  return (
    <AnimatePresence>
      {!fading && (
        <motion.div
          className="flex min-h-[60vh] items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.97, filter: "blur(10px)" }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <div className="relative w-full max-w-xl">
            {/* ── Terminal card ────────────────────────────────── */}
            <motion.div
              className="relative overflow-hidden rounded-xl border border-border bg-card"
              initial={{ y: 20, opacity: 0, filter: "blur(8px)" }}
              animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.5, ease: EASE, delay: 0.1 }}
            >
              {/* Title bar */}
              <div className="flex items-center gap-2.5 border-b border-border px-4 py-2.5">
                <Terminal className={`size-3.5 ${accentCls}`} />
                <span className="font-mono text-xs text-muted-foreground">
                  {title ?? "repofy — analysis engine"}
                </span>
                <div className="ml-auto flex items-center gap-3">
                  <span className="font-mono text-[10px] tabular-nums text-muted-foreground/30">
                    {elapsed.toFixed(1)}s
                  </span>
                  <span className="font-mono text-[10px] tabular-nums text-muted-foreground/50">
                    {Math.round(displayProgress)}%
                  </span>
                </div>
              </div>

              {/* Terminal body */}
              <div className="space-y-4 p-5">
                {/* ── Waveform visualizer ──────────────────────── */}
                <motion.div
                  className="rounded-lg bg-secondary/30 px-3 py-3"
                  initial={{ opacity: 0, scaleY: 0.8 }}
                  animate={{ opacity: 1, scaleY: 1 }}
                  transition={{ duration: 0.4, ease: EASE, delay: 0.25 }}
                  style={{ transformOrigin: "bottom" }}
                >
                  <div
                    className="flex items-end justify-center gap-[2px]"
                    style={{ height: 48 }}
                  >
                    {Array.from({ length: BAR_COUNT }, (_, i) => (
                      <motion.div
                        key={i}
                        className="w-[3px] shrink-0 rounded-full"
                        style={{
                          height: "100%",
                          transformOrigin: "bottom",
                          backgroundColor: complete
                            ? "rgba(52,211,153,0.35)"
                            : `${hex}60`,
                          transition: "background-color 0.4s ease",
                        }}
                        animate={
                          complete
                            ? { scaleY: 0.1 }
                            : { scaleY: [0.25, 1, 0.25] }
                        }
                        transition={
                          complete
                            ? { duration: 0.6, ease: "easeOut" }
                            : {
                                duration: 1.8,
                                ease: "easeInOut",
                                repeat: Infinity,
                                delay: i * 0.05,
                              }
                        }
                      />
                    ))}
                  </div>
                </motion.div>

                {/* ── Phase list ───────────────────────────────── */}
                <div className="space-y-2.5">
                  {phases.map((text, i) => {
                    const done = i < phase || complete;
                    const active = i === phase && !complete;
                    const visible = i <= phase;

                    return (
                      <motion.div
                        key={text}
                        className="flex items-center gap-3 font-mono text-sm"
                        initial={{ opacity: 0, x: -10, filter: "blur(4px)" }}
                        animate={
                          visible
                            ? { opacity: 1, x: 0, filter: "blur(0px)" }
                            : { opacity: 0, x: -10, filter: "blur(4px)" }
                        }
                        transition={{ duration: 0.35, ease: EASE }}
                      >
                        {/* Status icon */}
                        {done ? (
                          <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.25, ease: EASE }}
                          >
                            <Check className="size-3.5 shrink-0 text-emerald-400" />
                          </motion.div>
                        ) : active ? (
                          <motion.span
                            className={`inline-flex size-3.5 shrink-0 items-center justify-center ${accentCls}`}
                            animate={{ opacity: [1, 0.2, 1] }}
                            transition={{
                              duration: 1,
                              repeat: Infinity,
                              ease: "easeInOut",
                            }}
                          >
                            &gt;
                          </motion.span>
                        ) : null}

                        {/* Phase text */}
                        <span
                          className={
                            done
                              ? "text-muted-foreground/50"
                              : active
                                ? "text-foreground"
                                : "text-muted-foreground/20"
                          }
                        >
                          {text}
                        </span>

                        {/* Blinking cursor */}
                        {active && (
                          <span
                            className="h-3.5 w-[1.5px] rounded-full animate-blink"
                            style={{ backgroundColor: hex }}
                          />
                        )}
                      </motion.div>
                    );
                  })}
                </div>

                {/* ── Divider ──────────────────────────────────── */}
                <div className="h-px bg-border" />

                {/* ── Activity log ─────────────────────────────── */}
                <div
                  className="relative overflow-hidden"
                  style={{ height: 84 }}
                >
                  {/* Entries anchored to bottom, overflow scrolls up */}
                  <div className="absolute bottom-0 left-0 right-0 space-y-0.5">
                    <AnimatePresence initial={false}>
                      {visibleLogs.map((entry) => (
                        <motion.div
                          key={entry.id}
                          initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
                          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.3, ease: EASE }}
                          className="flex items-center gap-3 py-0.5"
                        >
                          <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground/25">
                            {entry.time}
                          </span>
                          <span className="truncate font-mono text-xs text-muted-foreground/60">
                            {entry.text}
                          </span>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  {/* Top fade gradient */}
                  <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-5 bg-gradient-to-b from-card to-transparent" />
                </div>

                {/* ── Progress bar ─────────────────────────────── */}
                <div>
                  <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{
                        width: `${Math.max(displayProgress, 2)}%`,
                        backgroundColor: "#34d399",
                        transition: complete
                          ? "width 0.3s ease-out"
                          : "width 0.15s linear",
                      }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* ── Phase dots ───────────────────────────────────── */}
            <motion.div
              className="mt-6 flex items-center justify-center gap-1.5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.4 }}
            >
              {phases.map((_, i) => (
                <motion.div
                  key={i}
                  className="rounded-full"
                  style={{ backgroundColor: complete ? "#34d399" : hex }}
                  initial={false}
                  animate={{
                    width: i === phase && !complete ? 20 : 6,
                    height: 6,
                    opacity:
                      i < phase || complete
                        ? 0.5
                        : i === phase
                          ? 1
                          : 0.1,
                  }}
                  transition={{ duration: 0.5, ease: EASE }}
                />
              ))}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
