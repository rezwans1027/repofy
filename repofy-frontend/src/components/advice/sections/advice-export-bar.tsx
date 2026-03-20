"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StickyBottomBar } from "@/components/ui/sticky-bottom-bar";
import { ExportPdfButton } from "@/components/ui/export-pdf-button";
import { CreditConfirmDialog } from "@/components/ui/credit-confirm-dialog";
import { NoCreditsDialog } from "@/components/ui/no-credits-dialog";
import { ADVISOR_ACCENT } from "@/lib/styles";
import { useCreditBalance } from "@/hooks/use-credits";
import { useExportPdf } from "@/hooks/use-export-pdf";

interface AdviceExportBarProps {
  username: string;
  adviceRef: React.RefObject<HTMLDivElement | null>;
  onBeforeExport: () => void;
  onAfterExport: () => void;
}

export function AdviceExportBar({ username, adviceRef, onBeforeExport, onAfterExport }: AdviceExportBarProps) {
  const router = useRouter();
  const { data: balance } = useCreditBalance();
  const [dialogOpen, setDialogOpen] = useState<"confirm_credit" | "no_credits" | null>(null);

  const { isExporting, handleExportPDF } = useExportPdf(
    adviceRef,
    `repofy-advice-${username}`,
    { onBeforeExport, onAfterExport },
  );

  const handleRunAgain = () => {
    if (balance && balance.growth_balance === 0) {
      setDialogOpen("no_credits");
    } else {
      setDialogOpen("confirm_credit");
    }
  };

  const closeDialog = useCallback((open: boolean) => {
    if (!open) setDialogOpen(null);
  }, []);

  return (
    <>
      <StickyBottomBar delay="0.4s">
        <p className="hidden font-mono text-xs text-muted-foreground sm:block">
          Advice for{" "}
          <span className={ADVISOR_ACCENT}>@{username}</span>
        </p>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            size="sm"
            variant="outline"
            className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-400 font-mono text-xs flex-1 sm:flex-initial"
            onClick={handleRunAgain}
          >
            <RefreshCw className="size-3.5" />
            Run Again
          </Button>
          <ExportPdfButton
            isExporting={isExporting}
            onClick={handleExportPDF}
            className="bg-emerald-500 text-background hover:bg-emerald-500/90 font-mono text-xs flex-1 sm:flex-initial"
          />
        </div>
      </StickyBottomBar>

      <NoCreditsDialog
        open={dialogOpen === "no_credits"}
        onOpenChange={closeDialog}
      />

      <CreditConfirmDialog
        open={dialogOpen === "confirm_credit"}
        onOpenChange={closeDialog}
        username={username}
        balance={balance?.growth_balance ?? 0}
        actionVerb="Regenerating"
        onConfirm={() => {
          setDialogOpen(null);
          router.push(`/advisor/generate/${username}`);
        }}
      />
    </>
  );
}
