"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sparkles, Lightbulb, Coins } from "lucide-react";
import { StickyBottomBar } from "@/components/ui/sticky-bottom-bar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/components/providers/auth-provider";
import { useExistingReport } from "@/hooks/use-reports";
import { useExistingAdvice } from "@/hooks/use-advice";
import { useCreditBalance } from "@/hooks/use-credits";

interface StickyCTABarProps {
  username: string;
}

type DialogType = "report" | "advice" | "no_credits" | "confirm_credit" | null;

export function StickyCTABar({ username }: StickyCTABarProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState<DialogType>(null);

  const { data: reportExists, isLoading: reportLoading } =
    useExistingReport(username);
  const { data: adviceExists, isLoading: adviceLoading } =
    useExistingAdvice(username);
  const { data: balance, isLoading: balanceLoading } = useCreditBalance();


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

  const closeDialog = useCallback((open: boolean) => {
    if (!open) setDialogOpen(null);
  }, []);

  return (
    <>
      <StickyBottomBar delay="0.4s">
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
      </StickyBottomBar>

      {/* Confirm credit dialog */}
      <AlertDialog open={dialogOpen === "confirm_credit"} onOpenChange={closeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-mono">Use 1 growth credit</AlertDialogTitle>
            <AlertDialogDescription>
              Generating advice for <span className="font-mono font-medium text-foreground">@{username}</span> will use <span className="font-mono font-medium text-emerald-400">1 growth credit</span>. You currently have <span className="font-mono font-medium text-foreground">{balance?.growth_balance ?? 0}</span> credit{balance?.growth_balance !== 1 ? "s" : ""}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel size="sm" className="font-mono text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              size="sm"
              className="bg-emerald-500 text-background hover:bg-emerald-500/90 font-mono text-xs"
              onClick={() => {
                setDialogOpen(null);
                router.push(`/advisor/generate/${username}`);
              }}
            >
              <Lightbulb className="size-3.5" />
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* No credits dialog */}
      <AlertDialog open={dialogOpen === "no_credits"} onOpenChange={closeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-mono">No growth credits</AlertDialogTitle>
            <AlertDialogDescription>
              You need at least 1 growth credit to get advice. Purchase credits to continue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel size="sm" className="font-mono text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              size="sm"
              className="bg-cyan text-background hover:bg-cyan/90 font-mono text-xs"
              asChild
            >
              <Link href="/pricing">
                <Coins className="size-3.5" />
                Buy Credits
              </Link>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Report already exists dialog */}
      <AlertDialog open={dialogOpen === "report"} onOpenChange={closeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-mono">Report already exists</AlertDialogTitle>
            <AlertDialogDescription>
              A report for <span className="font-mono font-medium text-foreground">@{username}</span> already exists. Generate a new report and replace the old one?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel size="sm" className="font-mono text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              size="sm"
              className="bg-cyan text-background hover:bg-cyan/90 font-mono text-xs"
              onClick={() => {
                setDialogOpen(null);
                router.push(`/generate/${username}`);
              }}
            >
              Replace report
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Advice already exists dialog */}
      <AlertDialog open={dialogOpen === "advice"} onOpenChange={closeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-mono">Advice already exists</AlertDialogTitle>
            <AlertDialogDescription>
              Advice for <span className="font-mono font-medium text-foreground">@{username}</span> already exists. Generate new advice and replace the old one? This will use <span className="font-mono font-medium text-emerald-400">1 growth credit</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel size="sm" className="font-mono text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              size="sm"
              className="bg-emerald-500 text-background hover:bg-emerald-500/90 font-mono text-xs"
              onClick={() => {
                setDialogOpen(null);
                router.push(`/advisor/generate/${username}`);
              }}
            >
              Replace advice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
