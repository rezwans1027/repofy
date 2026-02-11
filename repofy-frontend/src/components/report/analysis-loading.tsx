"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Terminal } from "lucide-react";

const DEFAULT_PHASES = [
  "Scanning profile...",
  "Reading top repositories...",
  "Analyzing code patterns...",
  "Generating report...",
];

interface AnalysisLoadingProps {
  fetchReport: () => Promise<unknown>;
  onComplete: (data: unknown) => void;
  onError: (message: string) => void;
  phases?: string[];
  accentColor?: string;
  title?: string;
}

export function AnalysisLoading({
  fetchReport,
  onComplete,
  onError,
  phases: phasesProp,
  accentColor,
  title,
}: AnalysisLoadingProps) {
  const phases = phasesProp ?? DEFAULT_PHASES;
  const [currentPhase, setCurrentPhase] = useState(0);
  const [progress, setProgress] = useState(0);
  const [fading, setFading] = useState(false);
  const fetchStarted = useRef(false);

  // Phase progression: ~1.2s apart
  useEffect(() => {
    setCurrentPhase(0);
    const timers = phases.map((_, i) =>
      setTimeout(() => setCurrentPhase(i), i * 1200),
    );
    return () => timers.forEach(clearTimeout);
  }, [phases]);

  // Start fetch on mount + animate progress bar
  useEffect(() => {
    if (fetchStarted.current) return;
    fetchStarted.current = true;

    const mountTime = Date.now();
    const MIN_DISPLAY_MS = 3000;
    let fetchResult: { data?: unknown; error?: string } | null = null;
    let cancelled = false;

    // Progress animation: fill to ~85% over ~8s, then slow crawl
    const progressRef = { value: 0 };
    const animateProgress = () => {
      if (cancelled) return;
      const elapsed = Date.now() - mountTime;
      // Fast phase: 0-85% over first 8 seconds
      if (elapsed < 8000) {
        progressRef.value = (elapsed / 8000) * 85;
      } else {
        // Slow crawl from 85% toward 95% (never reaches 100 until data arrives)
        const extra = (elapsed - 8000) / 30000; // ~30s to crawl 10%
        progressRef.value = 85 + Math.min(extra * 10, 10);
      }
      setProgress(progressRef.value);
      requestAnimationFrame(animateProgress);
    };
    requestAnimationFrame(animateProgress);

    // Fire API call
    fetchReport()
      .then((data) => {
        fetchResult = { data };
      })
      .catch((err) => {
        fetchResult = { error: err instanceof Error ? err.message : "Analysis failed" };
      })
      .finally(() => {
        if (cancelled) return;

        const elapsed = Date.now() - mountTime;
        const remaining = Math.max(MIN_DISPLAY_MS - elapsed, 0);

        setTimeout(() => {
          if (cancelled) return;
          cancelled = true;

          if (fetchResult?.error) {
            onError(fetchResult.error);
            return;
          }

          // Snap to 100% and fade out
          setProgress(100);
          setCurrentPhase(phases.length); // mark all phases complete
          setTimeout(() => setFading(true), 400);
          setTimeout(() => onComplete(fetchResult!.data), 800);
        }, remaining);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
                <Terminal className={`size-3.5 ${accentColor ? accentColor : "text-cyan"}`} />
                <span className="font-mono text-xs text-muted-foreground">
                  {title ?? "repofy — analysis engine"}
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
