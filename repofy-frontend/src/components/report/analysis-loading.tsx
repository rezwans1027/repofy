"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Terminal } from "lucide-react";

const phases = [
  "Scanning profile...",
  "Reading top repositories...",
  "Analyzing code patterns...",
  "Generating report...",
];

interface AnalysisLoadingProps {
  onComplete: (reportData?: unknown) => void;
  /** If provided, runs this async task and calls onComplete with the result when done */
  fetchReport?: () => Promise<unknown>;
}

export function AnalysisLoading({ onComplete, fetchReport }: AnalysisLoadingProps) {
  const [currentPhase, setCurrentPhase] = useState(0);
  const [progress, setProgress] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Phase progression: ~2s apart (allow time for API)
    const timers = phases.map((_, i) =>
      setTimeout(() => setCurrentPhase(i), i * 2000),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    const duration = fetchReport ? 30000 : 4800; // 30s max for real API, 5s for demo
    const start = Date.now();

    const tick = () => {
      const elapsed = Date.now() - start;
      const pct = Math.min(elapsed / duration, 0.95); // Cap at 95% until done
      setProgress(pct * 100);
      if (pct < 0.95) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    const done = (result?: unknown) => {
      setProgress(100);
      setFading(true);
      setTimeout(() => onComplete(result), 300);
    };

    if (fetchReport) {
      fetchReport()
        .then(done)
        .catch((err) => {
          console.error("Analysis fetch failed:", err);
          done(undefined);
        });
    } else {
      const fadeTimer = setTimeout(() => setFading(true), duration - 300);
      const completeTimer = setTimeout(() => onComplete(), duration);
      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(completeTimer);
      };
    }
  }, [onComplete, fetchReport]);

  return (
    <AnimatePresence>
      {!fading && (
        <motion.div
          className="flex min-h-[60vh] items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="w-full max-w-lg">
            {/* Terminal window */}
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              {/* Title bar */}
              <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
                <Terminal className="size-3.5 text-cyan" />
                <span className="font-mono text-xs text-muted-foreground">
                  repofy — analysis engine
                </span>
              </div>

              {/* Terminal body */}
              <div className="p-5 space-y-3">
                {phases.map((phase, i) => (
                  <motion.div
                    key={phase}
                    className="flex items-center gap-3 font-mono text-sm"
                    initial={{ opacity: 0, x: -8 }}
                    animate={
                      i <= currentPhase
                        ? { opacity: 1, x: 0 }
                        : { opacity: 0, x: -8 }
                    }
                    transition={{ duration: 0.3 }}
                  >
                    {i < currentPhase ? (
                      <Check className="size-3.5 text-emerald-400 shrink-0" />
                    ) : i === currentPhase ? (
                      <motion.span
                        className="inline-block size-3.5 shrink-0 text-center text-cyan"
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 0.8, repeat: Infinity }}
                      >
                        &gt;
                      </motion.span>
                    ) : null}
                    <span
                      className={
                        i < currentPhase
                          ? "text-muted-foreground"
                          : i === currentPhase
                            ? "text-foreground"
                            : "text-muted-foreground/40"
                      }
                    >
                      {phase}
                    </span>
                  </motion.div>
                ))}

                {/* Progress bar */}
                <div className="pt-3">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <motion.div
                      className="h-full rounded-full bg-cyan"
                      style={{ width: `${progress}%` }}
                      transition={{ duration: 0.1 }}
                    />
                  </div>
                  <p className="mt-2 text-right font-mono text-[10px] text-muted-foreground">
                    {Math.round(progress)}%
                  </p>
                </div>
              </div>
            </div>

            {/* Pulsing glow */}
            <motion.div
              className="mx-auto mt-6 h-1 w-32 rounded-full bg-cyan/30"
              animate={{ opacity: [0.3, 0.8, 0.3], scaleX: [0.8, 1, 0.8] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
