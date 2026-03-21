"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
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
  /** Seconds to fast-forward elapsed timer (for resume mode). */
  initialElapsed?: number;
  /** Externally signal job completion (triggers phase completion + fade). */
  completed?: boolean;
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
  initialElapsed = 0,
  completed: completedProp,
}: AnalysisLoadingProps) {
  const phases = phasesProp ?? DEFAULT_PHASES;
  const initPhase = initialElapsed > 0
    ? Math.min(Math.floor(initialElapsed / (90 / phases.length)), phases.length - 1)
    : 0;
  const [phase, setPhase] = useState(initPhase);
  const [fading, setFading] = useState(false);
  const [elapsed, setElapsed] = useState(initialElapsed);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const fetchStarted = useRef(false);
  const mountedRef = useRef(true);
  const logId = useRef(0);
  const completionHandled = useRef(false);
  const fetchCurrentReport = useEffectEvent(fetchReport);
  const handleComplete = useEffectEvent(onComplete);
  const handleError = useEffectEvent(onError);

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

  /* Elapsed timer — ticks every 100 ms, offset by initialElapsed */
  useEffect(() => {
    const t0 = Date.now() - initialElapsed * 1000;
    const id = setInterval(() => setElapsed((Date.now() - t0) / 1000), 100);
    return () => clearInterval(id);
  }, [initialElapsed]);

  /* Phase progression — spread evenly across 90 s, fast-forward if resuming */
  useEffect(() => {
    const interval = 90000 / phases.length; // ~11.25 s per phase
    const offsetMs = initialElapsed * 1000;
    const resetId = requestAnimationFrame(() => setPhase(initPhase));
    const t = phases
      .map((_, i) => {
        const targetMs = i * interval + 800;
        const delay = targetMs - offsetMs;
        if (delay <= 0) return null; // already past this phase
        return setTimeout(() => setPhase(i), delay);
      })
      .filter(Boolean) as ReturnType<typeof setTimeout>[];
    return () => {
      cancelAnimationFrame(resetId);
      t.forEach(clearTimeout);
    };
  }, [phases, initialElapsed, initPhase]);

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

  /* Fetch + progress bar
   *
   * mountedRef tracks whether the component is currently mounted.
   * fetchStarted prevents duplicate API calls (important: advisor deducts credits).
   *
   * In React Strict Mode the effect sequence is:
   *   mount-1 → cleanup → mount-2
   * Refs survive across this cycle, so fetchStarted stays true and only one
   * fetch fires. mountedRef is reset to true on every mount, so the fetch
   * completion handler (from mount-1's closure) still sees mountedRef.current
   * === true after mount-2 runs, allowing it to finish normally.
   *
   * A closure-local `dead` flag would be set to true by cleanup and never
   * cleared, silently swallowing the response — that was the original bug.
   */
  useEffect(() => {
    mountedRef.current = true;

    if (!fetchStarted.current) {
      fetchStarted.current = true;

      const t0 = Date.now();
      const MIN = 3000;
      let res: { data?: unknown; error?: string } | null = null;

      fetchCurrentReport()
        .then((d) => {
          res = { data: d };
        })
        .catch((err) => {
          res = {
            error: err instanceof Error ? err.message : "Analysis failed",
          };
        })
        .finally(() => {
          if (!mountedRef.current) return;
          const wait = Math.max(MIN - (Date.now() - t0), 0);
          setTimeout(() => {
            if (!mountedRef.current) return;
            if (res?.error) {
              handleError(res.error);
              return;
            }
            setPhase(phases.length);
            setTimeout(() => setFading(true), 400);
            setTimeout(() => {
              if (mountedRef.current) handleComplete(res!.data);
            }, 800);
          }, wait);
        });
    }

    return () => {
      mountedRef.current = false;
    };
  }, [phases.length]);

  /* External completion signal — triggered when completedProp flips to true */
  useEffect(() => {
    if (!completedProp || completionHandled.current) return;
    completionHandled.current = true;
    setPhase(phases.length);
    setTimeout(() => setFading(true), 400);
    setTimeout(() => {
      if (mountedRef.current) handleComplete(null);
    }, 800);
  }, [completedProp, phases.length, handleComplete]);

  /* Only show the last 4 log entries */
  const visibleLogs = logs.slice(-4);

  return (
    <AnimatePresence>
      {!fading && (
        <motion.div
          className="flex min-h-[60vh] items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <div className="relative w-full max-w-xl">
            {/* ── Terminal card ────────────────────────────────── */}
            <motion.div
              className="relative overflow-hidden rounded-xl border border-border bg-card"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
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
                      <div
                        key={i}
                        className="w-[3px] shrink-0 rounded-full"
                        style={{
                          height: "100%",
                          transformOrigin: "bottom",
                          backgroundColor: complete
                            ? "rgba(52,211,153,0.35)"
                            : `${hex}60`,
                          transition: complete
                            ? "background-color 0.4s ease, transform 0.6s ease-out"
                            : "background-color 0.4s ease",
                          transform: complete ? "scaleY(0.1)" : undefined,
                          animation: complete
                            ? "none"
                            : `waveform-bar 1.8s ease-in-out ${i * 0.05}s infinite`,
                        }}
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
                        initial={{ opacity: 0, x: -10 }}
                        animate={
                          visible
                            ? { opacity: 1, x: 0 }
                            : { opacity: 0, x: -10 }
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
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
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
