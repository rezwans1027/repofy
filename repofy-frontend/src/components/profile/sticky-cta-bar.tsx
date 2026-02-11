"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sparkles, Lightbulb } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { useExistingReport } from "@/hooks/use-reports";
import { useExistingAdvice } from "@/hooks/use-advice";

interface StickyCTABarProps {
  username: string;
  delay?: number;
}

type DialogType = "report" | "advice" | null;

export function StickyCTABar({ username, delay = 50 }: StickyCTABarProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [dialogOpen, setDialogOpen] = useState<DialogType>(null);

  const { data: reportExists, isLoading: reportLoading } =
    useExistingReport(username);
  const { data: adviceExists, isLoading: adviceLoading } =
    useExistingAdvice(username);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  const handleAnalysisClick = useCallback(() => {
    if (reportExists) {
      setDialogOpen("report");
    } else {
      router.push(`/generate/${username}`);
    }
  }, [reportExists, router, username]);

  const handleAdviceClick = useCallback(() => {
    if (adviceExists) {
      setDialogOpen("advice");
    } else {
      router.push(`/advisor/generate/${username}`);
    }
  }, [adviceExists, router, username]);

  return (
    <>
      <div
        className={`fixed bottom-0 left-0 right-0 lg:left-48 z-50 border-t border-border bg-background/80 backdrop-blur-md transition-[transform,opacity] duration-500 ${show ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"}`}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="hidden sm:block">
            <p className="font-mono text-sm font-bold">
              Analyze <span className="text-cyan">@{username}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Generate a report or get actionable advice
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              size="lg"
              className="bg-cyan text-background hover:bg-cyan/90 font-mono text-sm px-6 flex-1 sm:flex-initial"
              disabled={!!user && reportLoading}
              onClick={handleAnalysisClick}
            >
              <Sparkles className="size-4" />
              Start Analysis
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="font-mono text-sm px-6 flex-1 sm:flex-initial border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-400"
              disabled={!!user && adviceLoading}
              onClick={handleAdviceClick}
            >
              <Lightbulb className="size-4" />
              Get Advice
            </Button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {dialogOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => setDialogOpen(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="relative w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-lg"
            >
              <h2 className="font-mono text-lg font-semibold">
                {dialogOpen === "report" ? "Report already exists" : "Advice already exists"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {dialogOpen === "report"
                  ? <>A report for <span className="font-mono font-medium text-foreground">@{username}</span> already exists. Generate a new report and replace the old one?</>
                  : <>Advice for <span className="font-mono font-medium text-foreground">@{username}</span> already exists. Generate new advice and replace the old one?</>
                }
              </p>
              <div className="mt-6 flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="font-mono text-xs"
                  onClick={() => setDialogOpen(null)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className={
                    dialogOpen === "report"
                      ? "bg-cyan text-background hover:bg-cyan/90 font-mono text-xs"
                      : "bg-emerald-500 text-background hover:bg-emerald-500/90 font-mono text-xs"
                  }
                  onClick={() => {
                    setDialogOpen(null);
                    if (dialogOpen === "report") {
                      router.push(`/generate/${username}`);
                    } else {
                      router.push(`/advisor/generate/${username}`);
                    }
                  }}
                >
                  {dialogOpen === "report" ? "Replace report" : "Replace advice"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
