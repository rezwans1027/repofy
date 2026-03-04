"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sparkles, Lightbulb, Coins } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/components/providers/auth-provider";
import { useExistingReport } from "@/hooks/use-reports";
import { useExistingAdvice } from "@/hooks/use-advice";
import { useCreditBalance } from "@/hooks/use-credits";

interface StickyCTABarProps {
  username: string;
  delay?: number;
}

type DialogType = "report" | "advice" | "no_credits" | "confirm_credit" | null;

export function StickyCTABar({ username, delay = 50 }: StickyCTABarProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dialogOpen, setDialogOpen] = useState<DialogType>(null);

  const { data: reportExists, isLoading: reportLoading } =
    useExistingReport(username);
  const { data: adviceExists, isLoading: adviceLoading } =
    useExistingAdvice(username);
  const { data: balance, isLoading: balanceLoading } = useCreditBalance();

  useEffect(() => {
    setMounted(true);
  }, []);

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
    if (balance && balance.growth_balance === 0) {
      setDialogOpen("no_credits");
      return;
    }
    if (adviceExists) {
      setDialogOpen("advice");
    } else {
      setDialogOpen("confirm_credit");
    }
  }, [adviceExists, balance, router, username]);

  return (
    <>
      <div
        className={`fixed bottom-0 left-0 right-0 lg:left-48 z-50 border-t border-border bg-background/80 backdrop-blur-md transition-[transform,opacity] duration-500 ease-out ${show ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"}`}
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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex-1 sm:flex-initial">
                    <Button
                      size="lg"
                      data-testid="generate-report-btn"
                      className="bg-cyan text-background font-mono text-sm px-6 w-full opacity-50 cursor-not-allowed"
                      disabled
                    >
                      <Sparkles className="size-4" />
                      Start Analysis
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>
                  Coming soon
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button
              size="lg"
              variant="outline"
              className="font-mono text-sm px-6 flex-1 sm:flex-initial border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-400"
              disabled={!!user && (adviceLoading || balanceLoading)}
              onClick={handleAdviceClick}
            >
              <Lightbulb className="size-4" />
              Get Advice
            </Button>
          </div>
        </div>
      </div>

      {mounted && createPortal(
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
                {dialogOpen === "confirm_credit" ? (
                  <>
                    <h2 className="font-mono text-lg font-semibold">Use 1 growth credit</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Generating advice for <span className="font-mono font-medium text-foreground">@{username}</span> will use <span className="font-mono font-medium text-emerald-400">1 growth credit</span>. You currently have <span className="font-mono font-medium text-foreground">{balance?.growth_balance ?? 0}</span> credit{balance?.growth_balance !== 1 ? "s" : ""}.
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
                        className="bg-emerald-500 text-background hover:bg-emerald-500/90 font-mono text-xs"
                        onClick={() => {
                          setDialogOpen(null);
                          router.push(`/advisor/generate/${username}`);
                        }}
                      >
                        <Lightbulb className="size-3.5" />
                        Continue
                      </Button>
                    </div>
                  </>
                ) : dialogOpen === "no_credits" ? (
                  <>
                    <h2 className="font-mono text-lg font-semibold">No growth credits</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      You need at least 1 growth credit to get advice. Purchase credits to continue.
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
                        className="bg-cyan text-background hover:bg-cyan/90 font-mono text-xs"
                        asChild
                      >
                        <Link href="/pricing">
                          <Coins className="size-3.5" />
                          Buy Credits
                        </Link>
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="font-mono text-lg font-semibold">
                      {dialogOpen === "report" ? "Report already exists" : "Advice already exists"}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {dialogOpen === "report"
                        ? <>A report for <span className="font-mono font-medium text-foreground">@{username}</span> already exists. Generate a new report and replace the old one?</>
                        : <>Advice for <span className="font-mono font-medium text-foreground">@{username}</span> already exists. Generate new advice and replace the old one? This will use <span className="font-mono font-medium text-emerald-400">1 growth credit</span>.</>
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
                  </>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
