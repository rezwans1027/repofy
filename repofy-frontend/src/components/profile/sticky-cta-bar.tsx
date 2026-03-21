"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sparkles, Lightbulb } from "lucide-react";
import { StickyBottomBar } from "@/components/ui/sticky-bottom-bar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CreditConfirmDialog } from "@/components/ui/credit-confirm-dialog";
import { NoCreditsDialog } from "@/components/ui/no-credits-dialog";
import { useAuth } from "@/components/providers/auth-provider";
import { useCreditBalance } from "@/hooks/use-credits";
import { useActiveAdviceJob } from "@/hooks/use-advice-job";
import { ActiveJobDialog } from "@/components/ui/active-job-dialog";

interface StickyCTABarProps {
  username: string;
}

type DialogType = "no_credits" | "confirm_credit" | "active_job" | null;

export function StickyCTABar({ username }: StickyCTABarProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState<DialogType>(null);

  const { data: balance, isLoading: balanceLoading } = useCreditBalance();
  const { data: activeJob } = useActiveAdviceJob();

  const handleAdviceClick = useCallback(() => {
    if (activeJob) {
      setDialogOpen("active_job");
      return;
    }
    if (balance && balance.growth_balance === 0) {
      setDialogOpen("no_credits");
      return;
    }
    setDialogOpen("confirm_credit");
  }, [balance, activeJob]);

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
            disabled={!!user && balanceLoading}
            onClick={handleAdviceClick}
          >
            <Lightbulb className="size-4" />
            Get Advice
          </Button>
        </div>
      </StickyBottomBar>

      <CreditConfirmDialog
        open={dialogOpen === "confirm_credit"}
        onOpenChange={closeDialog}
        username={username}
        balance={balance?.growth_balance ?? 0}
        actionVerb="Generating"
        onConfirm={() => {
          setDialogOpen(null);
          router.push(`/advisor/generate/${username}`);
        }}
      />

      <NoCreditsDialog
        open={dialogOpen === "no_credits"}
        onOpenChange={closeDialog}
      />

      <ActiveJobDialog
        open={dialogOpen === "active_job"}
        onOpenChange={closeDialog}
        activeJob={activeJob ?? null}
      />
    </>
  );
}
