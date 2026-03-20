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
import { CreditConfirmDialog } from "@/components/ui/credit-confirm-dialog";
import { NoCreditsDialog } from "@/components/ui/no-credits-dialog";
import { useAuth } from "@/components/providers/auth-provider";
import { useExistingAdvice } from "@/hooks/use-advice";
import { useCreditBalance } from "@/hooks/use-credits";

interface StickyCTABarProps {
  username: string;
}

type DialogType = "advice" | "no_credits" | "confirm_credit" | null;

export function StickyCTABar({ username }: StickyCTABarProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState<DialogType>(null);

  const { data: adviceExists, isLoading: adviceLoading } =
    useExistingAdvice(username);
  const { data: balance, isLoading: balanceLoading } = useCreditBalance();

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
  }, [adviceExists, balance]);

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
